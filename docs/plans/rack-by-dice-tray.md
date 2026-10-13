# Plan: Tool rack in front of the dice tray

Requested by the user on 2026-10-13. Status: Part 1 done.

One coder step and one commit.

## Request

The tool rack lies below the character trays, along the whole table edge. A row of 8 trays is almost never needed (the biggest squad so far has 7 characters). So the rack moves in front of the dice tray of its player, in this order:

```
R1 R2 R3 R4 R5
L  M  S  T/A
```

## Facts

- Rack now: `src/tabletools/layout.js`, x −15.2 … 15.2, z 34.2 … 36.8 (host). Tools lie along x. Row 1 is 29" long (R1 chip 2", R2 3", R3 6", R4 8", R5 10").
- Dice trays (`src/dice/tray.js`, `TRAYS`): host at x 27, z 10.1. Guest at x 27, z −10.1. So the dice trays are not mirrored in x. The host tray is on the host's right, and the guest tray is on the guest's left.
- The keys lip of the dice tray ends at tray-space z −6.92, so at world z ±17.0. The tray is about 13.2" wide: x 20.4 … 33.6.
- Free in front of the host dice tray: x 20.4 … 35.4, z 17.3 … 22.4. A row of 7 trays ends at x 20.65 (plate edge). A row of 8 or more trays reaches under the new rack, z 22.7 … 33.75.
- The roster rows of the setup span the table width at z 22.7 … 29.5.
- Edge controls of the setup end at x 16.45. The board strip and the Power Phase button are on the other side (−x). Neither meets the new rack.
- The squad panel ends at `RACK_Z_MIN − 0.25` (`squadPanel` in `layout.js`).
- Users: `onRack` (return to rack, drag outline dim, `dropShape.js`), `rackPlate`, `rackSlots`, `rackYaw`, tests in `layout.test.js` and `dropShape.test.js`.

## Decisions

1. **Tools lie along z** (vertical from the player's view, as the user asked), the tip toward the mat. 5 real-size tools along x do not fit in the 13" width of the dice tray. So each item of the request is a column.
2. **Columns, stacked.** Each column has its row 1 item on the mat side and its row 2 item below it, toward the table edge:

   | Column | Row 1 | Row 2 | Depth |
   |---|---|---|---|
   | 1 | R1 chip (1") | L (7.07") | 8.5" |
   | 2 | R2 (3") | M (5.05") | 8.5" |
   | 3 | R3 (6") | S (3.15") | 9.6" |
   | 4 | R4 (8") | T/A chip (1") | 9.4" |
   | 5 | R5 (10") | — | 10" |

   With a 0.4" gap in a column and 0.3" margins, the plate is about 10.6" deep: host z 17.3 … 27.9. Two separate rows would need about 18.5".
3. **Place:** the plate is centered in x on the dice tray (x 27 for both sides), as wide as the tray (about 13"), starting 0.3" past the keys lip. Guest: x 27, z −17.3 … −27.9, turned 180° (`rackYaw`). The order is still from the owner's left. So the host R1 is at the low x end, and the guest R1 is at the high x end.
4. Chips stay 2" × 1", with the text facing the owner. The columns are spaced so that a 2" chip fits.
5. **Overlap with trays.** A row of 8 or more trays lies under the rack. The request accepts this. The rack draws above the tray plates, so the tools stay visible.
6. **Overlap with the roster rows (setup).** The rack is hidden while the roster rows are on the table. It shows again on the squad reveal, before deployment. A tool that is on the table stays.
7. The squad panel keeps its old far edge, z 33.95 (a constant in `layout.js`, not `RACK_Z_MIN`). Its size does not change.
8. The camera start view does not change. It still shows the trays up to z 33.75. Only the comments and docs that name the rack band change.
9. The table stays 76" deep. The old rack band (z 34.2 … 38) is now free. Making the table smaller is a separate request, because the grunt block of `grunts-constructs` uses that band.

## Part 1: Move the rack

Work:
1. `src/tabletools/layout.js`: the new rack plate and slots (Decisions 1 to 4). A slot gets its own yaw (tools along z). Export the dice tray center from `dice/tray.js` or read `TRAYS`. Update the comments.
2. The rack component and the tool meshes on it: turn the tools 90° so they lie along z. The hover label and the drag still work.
3. The squad panel edge (Decision 7).
4. Hide the rack while the roster rows show (Decision 6).
5. Tests: `layout.test.js` (the rack is inside the table, in front of the dice tray keys lip, slots inside the plate, no slot overlap, guest is the turned host), `dropShape.test.js`.
6. Docs: `docs/features/table-tools.md` ("Place on the table", "Tool rack", the drawing), `docs/features/character-trays.md` (rack band lines 9, 86, 111, 350), `docs/features/setup-game.md` (squad panel line), `docs/features/key-shortcuts.md` (start view), comments in `src/table.js` and `src/camera.js`.

Checks: `pnpm format`, `pnpm lint`, `pnpm --filter web test`, `pnpm --filter web build`.

### Result

- Rack plate: x 20.6 … 33.4 (12.8" wide, not the 13.2" of the tray, so a row of 7 trays, ending at x 20.5, stays clear), z 17.32 … 27.92 host, mirrored in z for guest (x stays). Computed in `layout.js` from `TRAYS` and `KEYS_LIP`.
- Slots have `sizeX` and `sizeZ` (footprint). Tools turn 90° in `ToolRack.jsx`. The plate and tools are raised (y 0.03 … 0.07) above the tray plates.
- Hide: `rackHiddenSides(setup, rosters)` in `setup/setup.js`. `ToolRack` does not mount a hidden rack, and `App.jsx` gives no `onToolReturn` then. It is per side, only when that side has a roster.
- `squadPanel` keeps its far edge z 33.95 as `SQUAD_PANEL_Z_MAX`.
- Docs and comments updated. Tests updated in `layout.test.js` and `dropShape.test.js`.

User checks:
- [ ] Host and guest racks lie in front of their dice trays, tools along z, columns as in Decision 2.
- [ ] Click and drag from the rack, return to the rack, faint copies, hover labels.
- [ ] 7 trays do not touch the rack.
- [ ] The setup with a wide roster (Decision 6).
