// Single shared duration driving the camera pointOfView() flight, the
// globe container's width shrink, and the "transition" -> "dashboard"
// ViewMode settle — so the camera zoom and the layout reframe read as one
// coordinated gesture instead of independently-timed animations racing
// each other, per CLAUDE.md's guidance on the container-morph risk.
export const CONTINENT_TRANSITION_MS = 1150;
