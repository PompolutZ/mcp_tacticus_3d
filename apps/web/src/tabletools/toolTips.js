// Half length of each tool: the distance from the middle to an outer tip. Plain module, no React, so the
// layout of the tool rack (layout.js) and its tests can read them in Node.

// X coordinate of the outer tip for each half, per movement tool type
export const MOVE_TIP = { short: 1.574, medium: 2.523, long: 3.535 }
// Per range tool mesh (2 to 5), the same
export const RANGE_TIP = { 2: 1.501, 3: 3.0, 4: 4.0, 5: 5.0 }
