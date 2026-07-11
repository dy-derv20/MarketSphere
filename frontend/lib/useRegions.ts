"use client";

import { useEffect, useState } from "react";
import { getRegions } from "@/lib/api/regions";
import type { Region } from "@/types/api";

export type RegionsState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; regions: Region[] };

// /api/regions is a static registry — fetched once and reused for every
// continent switch, not re-fetched per selection.
export function useRegions(): RegionsState {
  const [state, setState] = useState<RegionsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getRegions()
      .then((regions) => {
        if (!cancelled) setState({ status: "ready", regions });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
