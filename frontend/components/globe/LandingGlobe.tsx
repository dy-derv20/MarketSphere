"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Globe, { type GlobeMethods } from "@/components/globe/Globe";
import countriesRaw from "@/lib/data/countries-110m.json";
import { CONTINENT_TRANSITION_MS } from "@/lib/transitionTiming";
import {
  type ContinentId,
  type CountryFeature,
  type CountryFeatureCollection,
  isContinentId,
} from "@/types/globe";

const countries = countriesRaw as CountryFeatureCollection;

// Self-hosted (see public/textures/) rather than pulled from unpkg at runtime:
// avoids a demo-day dependency on a third-party CDN + unpinned package version.
const GLOBE_IMAGE_URL = "/textures/earth-blue-marble.jpg";
const BUMP_IMAGE_URL = "/textures/earth-topology.png";
const BACKGROUND_IMAGE_URL = "/textures/night-sky.png";

const AUTO_ROTATE_SPEED = 0.35;

// Reasonable continental-interior points (not true polygon centroids, which
// can land in bays/peninsulas) chosen to read well as a label anchor.
const CONTINENT_CENTROIDS: Record<ContinentId, { lat: number; lng: number }> = {
  "North America": { lat: 45, lng: -100 },
  "South America": { lat: -15, lng: -60 },
  Europe: { lat: 50, lng: 15 },
  Africa: { lat: 5, lng: 20 },
  Asia: { lat: 45, lng: 90 },
  Oceania: { lat: -25, lng: 135 },
};

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}
const REST_CAP: RGBA = { r: 0, g: 0, b: 0, a: 0 };
const HIGHLIGHT_CAP: RGBA = { r: 90, g: 209, b: 224, a: 0.35 };
const REST_STROKE: RGBA = { r: 255, g: 255, b: 255, a: 0.25 };
const HIGHLIGHT_STROKE: RGBA = { r: 180, g: 238, b: 245, a: 0.9 };
const REST_ALTITUDE = 0.001;
const HIGHLIGHT_ALTITUDE = 0.012; // deliberately far from REST_ALTITUDE: avoids
// near-coplanar z-fighting between the visible highlighted caps and the ~176
// other (invisible, alpha=0) resting caps that are always present in the scene.

const HIGHLIGHT_FADE_MS = 200;
const CAMERA_ZOOM_ALTITUDE = 1.3;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function rgbaStr(c: RGBA) {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a})`;
}
function mixRgba(from: RGBA, to: RGBA, t: number) {
  return rgbaStr({
    r: lerp(from.r, to.r, t),
    g: lerp(from.g, to.g, t),
    b: lerp(from.b, to.b, t),
    a: lerp(from.a, to.a, t),
  });
}

function normalize(v: { x: number; y: number; z: number }) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

interface LabelPosition {
  x: number;
  y: number;
  visible: boolean;
}

interface LandingGlobeProps {
  onContinentSelect?: (continentId: ContinentId) => void;
}

export default function LandingGlobe({ onContinentSelect }: LandingGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // hoveredContinent: transient, follows the cursor, frozen once locked.
  // lockedContinent: persists after a click, survives mouse-leave, and
  // takes precedence once set (defense in depth — see isLockedRef below).
  const [hoveredContinent, setHoveredContinent] = useState<ContinentId | null>(null);
  const [lockedContinent, setLockedContinent] = useState<ContinentId | null>(null);
  const activeContinent = lockedContinent ?? hoveredContinent;

  // A ref (not state) so the freeze is visible synchronously to any hover
  // event firing in the same tick as the click — state updates batch and
  // can leave handlePolygonHover's closure reading a stale pre-lock value
  // for one more event, which caused a real bug: as the canvas resizes
  // post-click, a stray hover-null (or hover-elsewhere) event landing in
  // that gap flipped activeContinent away from the locked continent and
  // back, unmounting/remounting the landmass label mid-transition.
  const isLockedRef = useRef(false);

  // Single 0→1 progress value driving the cap/stroke/altitude fade whenever
  // activeContinent changes to a new target. Only "fades into" a highlight,
  // per spec — leaving a highlight (activeContinent -> a different value or
  // null) resets instantly, which is a deliberate simplification.
  const [fadeProgress, setFadeProgress] = useState(1);
  const fadeRafRef = useRef<number | null>(null);
  const fadeStartRef = useRef<number | null>(null);

  const [labelPos, setLabelPos] = useState<LabelPosition | null>(null);

  // Tracks the container's actual rendered box (not window.innerWidth/Height),
  // via ResizeObserver rather than a window "resize" listener. This is the
  // fix for the known WebGL-canvas-resize risk from CLAUDE.md: as long as
  // the Globe's width/height props always match the container's current
  // CSS size, react-globe.gl keeps its renderer's draw buffer in sync —
  // including every intermediate frame of a Framer Motion width animation
  // shrinking this container into the docked dashboard frame, since
  // ResizeObserver fires on every actual layout-size change, not just on
  // window resize. This also keeps landmass label anchoring correct
  // through the same resize, since both derive from this one observed box.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stopAutoRotate = useCallback(() => {
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = false;
  }, []);

  const handleGlobeReady = useCallback(() => {
    // react-globe.gl's onGlobeReady firing and React actually attaching
    // globeRef.current are two separately-orchestrated things (the ref
    // isn't guaranteed populated by the moment this callback runs) — a
    // real, intermittent race that only showed up in production builds
    // (dev mode's inherent slowness happened to always mask it). Retrying
    // for a few frames is a robust fix; giving up silently on the first
    // miss (the old behavior) meant auto-rotate + the interaction-stop
    // listener sometimes never got wired up at all.
    const trySetup = (attemptsLeft: number) => {
      const controls = globeRef.current?.controls();
      if (!controls) {
        if (attemptsLeft > 0) requestAnimationFrame(() => trySetup(attemptsLeft - 1));
        return;
      }

      controls.autoRotate = true;
      controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
      controls.enableDamping = true;

      const onInteractionStart = () => {
        stopAutoRotate();
        controls.removeEventListener("start", onInteractionStart);
      };
      controls.addEventListener("start", onInteractionStart);
    };
    trySetup(60); // ~1s at 60fps
  }, [stopAutoRotate]);

  // Drives the cap/stroke/altitude fade-in. Runs only on continent-boundary
  // crossings (not on every mousemove within one continent), bounded to
  // HIGHLIGHT_FADE_MS.
  useEffect(() => {
    if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    if (!activeContinent) {
      setFadeProgress(1);
      return;
    }

    fadeStartRef.current = null;
    setFadeProgress(0);

    const tick = (now: number) => {
      if (fadeStartRef.current === null) fadeStartRef.current = now;
      const t = Math.min(1, (now - fadeStartRef.current) / HIGHLIGHT_FADE_MS);
      setFadeProgress(t);
      if (t < 1) fadeRafRef.current = requestAnimationFrame(tick);
    };
    fadeRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (fadeRafRef.current !== null) cancelAnimationFrame(fadeRafRef.current);
    };
  }, [activeContinent]);

  // Memoized on activeContinent + fadeProgress only: moving the cursor
  // between countries within the same continent changes neither, so
  // three-globe re-evaluates the (cheap) accessor without ever touching
  // polygonsData itself, which stays the same array for the app's lifetime.
  const polygonCapColor = useCallback(
    (feature: object) => {
      const continent = (feature as CountryFeature).properties.CONTINENT;
      return continent === activeContinent ? mixRgba(REST_CAP, HIGHLIGHT_CAP, fadeProgress) : rgbaStr(REST_CAP);
    },
    [activeContinent, fadeProgress],
  );

  const polygonStrokeColor = useCallback(
    (feature: object) => {
      const continent = (feature as CountryFeature).properties.CONTINENT;
      return continent === activeContinent
        ? mixRgba(REST_STROKE, HIGHLIGHT_STROKE, fadeProgress)
        : rgbaStr(REST_STROKE);
    },
    [activeContinent, fadeProgress],
  );

  const polygonAltitude = useCallback(
    (feature: object) => {
      const continent = (feature as CountryFeature).properties.CONTINENT;
      return continent === activeContinent ? lerp(REST_ALTITUDE, HIGHLIGHT_ALTITUDE, fadeProgress) : REST_ALTITUDE;
    },
    [activeContinent, fadeProgress],
  );

  const updateLabelPosition = useCallback(() => {
    const globe = globeRef.current;
    if (!activeContinent || !globe) {
      setLabelPos(null);
      return;
    }
    const { lat, lng } = CONTINENT_CENTROIDS[activeContinent];
    const screen = globe.getScreenCoords(lat, lng, 0);
    const pointDir = normalize(globe.getCoords(lat, lng, 0));
    const camDir = normalize(globe.camera().position);
    const visible = dot(pointDir, camDir) > 0.15; // facing the camera, with margin before the limb
    setLabelPos({ x: screen.x, y: screen.y, visible });
  }, [activeContinent]);

  // Always-current ref to updateLabelPosition. Needed because the rAF loop
  // below is *started* once (from handlePolygonClick's closure) but must
  // keep running for the full transition duration — without this ref, the
  // loop's `tick` function would close over whatever updateLabelPosition
  // was bound to at click time (activeContinent still null, pre-render),
  // and would keep calling that stale version every frame for the whole
  // transition, repeatedly stomping labelPos back to null. This was a real
  // bug: it caused the label to flicker in and out during the transition.
  const updateLabelPositionRef = useRef(updateLabelPosition);
  useEffect(() => {
    updateLabelPositionRef.current = updateLabelPosition;
  }, [updateLabelPosition]);

  // Recompute immediately when the target continent changes, then keep
  // tracking continuously via onZoom (fires on every OrbitControls
  // "change" event — auto-rotate ticks, drag, and scroll all included).
  useEffect(() => {
    updateLabelPosition();
  }, [updateLabelPosition]);

  // pointOfView()'s own camera tween isn't confirmed to dispatch the
  // OrbitControls "change" event onZoom relies on, so during the post-click
  // camera flight we drive updateLabelPosition from our own bounded rAF
  // loop instead of trusting onZoom to fire — cheap, and correct either way.
  const labelTrackingRafRef = useRef<number | null>(null);
  const trackLabelDuringTransition = useCallback((durationMs: number) => {
    if (labelTrackingRafRef.current !== null) cancelAnimationFrame(labelTrackingRafRef.current);
    const start = performance.now();
    const tick = (now: number) => {
      updateLabelPositionRef.current();
      if (now - start < durationMs) {
        labelTrackingRafRef.current = requestAnimationFrame(tick);
      }
    };
    labelTrackingRafRef.current = requestAnimationFrame(tick);
  }, []);
  useEffect(() => {
    return () => {
      if (labelTrackingRafRef.current !== null) cancelAnimationFrame(labelTrackingRafRef.current);
    };
  }, []);

  const handlePolygonHover = useCallback((feature: object | null) => {
    // Once a continent is locked (clicked), stop responding to hover.
    // Hover-preview is a pre-selection affordance; freezing it here also
    // avoids a real bug: as the canvas resizes into the docked frame
    // post-click, a stationary cursor's raycasted target silently drifts to
    // a different polygon underneath it (the projection changes as the
    // canvas shrinks even though the pointer hasn't moved), which would
    // otherwise flip hoveredContinent mid-transition and briefly show/track
    // the wrong continent. Reads a ref (not the lockedContinent state)
    // because state updates batch — a hover event firing in the same tick
    // as the click could otherwise still see a stale pre-lock closure.
    if (isLockedRef.current) return;
    const continent = (feature as CountryFeature | null)?.properties.CONTINENT;
    setHoveredContinent(isContinentId(continent) ? continent : null);
  }, []);

  const handlePolygonClick = useCallback(
    (feature: object) => {
      const continent = (feature as CountryFeature).properties.CONTINENT;
      if (!isContinentId(continent)) return; // Antarctica / open ocean: no-op

      isLockedRef.current = true;
      stopAutoRotate();
      setLockedContinent(continent);

      const { lat, lng } = CONTINENT_CENTROIDS[continent];
      globeRef.current?.pointOfView({ lat, lng, altitude: CAMERA_ZOOM_ALTITUDE }, CONTINENT_TRANSITION_MS);
      trackLabelDuringTransition(CONTINENT_TRANSITION_MS);

      if (onContinentSelect) {
        onContinentSelect(continent);
      } else {
        console.log("[LandingGlobe] onContinentSelect:", continent);
      }
    },
    [onContinentSelect, stopAutoRotate, trackLabelDuringTransition],
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl={GLOBE_IMAGE_URL}
        bumpImageUrl={BUMP_IMAGE_URL}
        backgroundImageUrl={BACKGROUND_IMAGE_URL}
        showAtmosphere
        atmosphereColor="#5ad1e0"
        atmosphereAltitude={0.2}
        polygonsData={countries.features}
        polygonCapColor={polygonCapColor}
        polygonSideColor={() => ""}
        polygonStrokeColor={polygonStrokeColor}
        polygonAltitude={polygonAltitude}
        polygonsTransitionDuration={0}
        onPolygonHover={handlePolygonHover}
        onPolygonClick={handlePolygonClick}
        onGlobeReady={handleGlobeReady}
        onZoom={updateLabelPosition}
      />

      <AnimatePresence>
        {!lockedContinent && (
          <motion.div
            initial={false}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="pointer-events-none absolute left-6 top-6 select-none sm:left-10 sm:top-10"
          >
            <div className="rounded-xl border border-white/10 bg-black/30 px-5 py-4 backdrop-blur-sm">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
                Explore the World&apos;s Markets
              </h1>
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
                Drag to rotate. Select a continent.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeContinent && labelPos && (
          <motion.div
            key={activeContinent}
            initial={{ opacity: 0 }}
            animate={{ opacity: labelPos.visible ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ position: "absolute", left: labelPos.x, top: labelPos.y, transform: "translate(-50%, -140%)" }}
            className="pointer-events-none flex select-none items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-black/30 px-4 py-2 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#5ad1e0]" />
            <span className="text-lg font-semibold tracking-tight text-zinc-50">{activeContinent}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
