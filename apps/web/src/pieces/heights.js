// Heights and rates shared by the pieces on the table (tokens, piles, markers, tool ghosts, cursors).

// Gap between the ground and the bottom of a token, pile or marker, so it never z-fights with the surface
export const SURFACE_GAP = 0.02

// Just above the table or terrain point, so a ring or an outline does not fight with the surface
export const MARKER_LIFT = 0.04

// How fast a dragged model or tool moves to the new hover height, per second
export const HOVER_RATE = 25
