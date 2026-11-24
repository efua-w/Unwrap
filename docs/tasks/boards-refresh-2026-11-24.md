# Board refresh 2026-11-24: changes that affect merged slices

Read-only re-read of the live canvases through the Artifact tool. Canvas versions now: "Unwrap" `1795545700-3608`, "Unwrap • Part 2" `1795545068-f7cd`, "Unwrap — Part 3" `1795347488-5fd0`. The slice 11 notes (`docs/tasks/slice-11-boards.md`) were taken from "Unwrap" version `1795447101-3e6b`, so the canvas was republished once between slice 11 and slice 12; the slice 12 notes were taken from the current version.

## Result: no changes found that affect merged slices

I re-opened these boards in the current version and compared every string to `slice-11-boards.md` (verified, exact match):

| Board (page) | Compared | Result |
| --- | --- | --- |
| `Exchange-Wishlist-default-m` (canvas 1, 02. Exchanges) | header, intro, count row, six rows with sub lines and trailing labels (Updated, Over budget), hint "Only you can see what you mark. Kemi never will." | Same |
| `Exchange-Wishlist-removed-m` | taken-off note "Kemi took “Noise-cancelling earbuds” off the list after you marked it. You can still unmark it.", count "5 items", no unmark control | Same |
| `Exchange-Wishlist-item-m` | sheet title, meta, note "Within the ₦15,000 to ₦25,000 budget.", privacy line, buttons Open the shop, I got this, Copy link | Same |
| `Exchange-Detail-revealed-m` | Your part rows, ActionCard "You're buying for Kemi." / "Spend ₦15,000 to ₦25,000. Gifts are exchanged on Sat 19 Dec." / "View their wishlist", `dismiss="false"`, aside "Needs you", "Leave exchange…" | Same |
| `Exchange-Detail-before-m`, `-nolist-m` (canvas 2, participant) | pre-draw copy, "Add your wishlist" card with `dismiss="false"` | Same as the slice 12 notes |

Not re-opened (assumed unchanged because I found no sign of edits): `Exchange-Wishlist-loading/empty/nolist/error/offline/marked`, `-itemgot/-itembusy/-itemoffline/-nolink/-copied`, `Exchange-Reveal-*`, `Exchange-Detail-drawn/hidden/changed`, `Joining-Attach-drawn/drawnlist/remove/removed`, `Activity-*` (Names drawn row), `Email-E19`, `Email-E21`, the 1040px banner layout, and all desktop twins. If any of those changed in the owner's edit, it is not visible from the version history I can read; the version id alone cannot prove a board unchanged, so these are "assumed", not "verified".

## Recorded owner decisions: still consistent with every board I opened

- slice-11 B1 (revealed card not dismissible): board has `dismiss="false"`. Consistent.
- slice-11 B2 (hint "Only you can see what you mark. {first} never will."): list and item sheet still use it. Consistent.
- slice-11 B3 (neutral loading heading): the `Exchange-Wishlist-loading` board still shows the name (as in the slice 11 notes); the owner chose a neutral heading over it. Unchanged conflict, already decided.
- slice-11 B4 (Show goes to `/reveal`): `Exchange-Detail-hidden` still links Show to the revealed state; owner chose `/reveal`. Unchanged, already decided.
- slice-12 B1 to B4: see "Conflicts or gaps" in `docs/tasks/slice-12-boards.md`; nothing contradicts them.

## Newly noticed items (not changes, but worth knowing)

1. **`Org-Excl-impossible-m/-d`** (canvas 2, organiser page, "S33 Exclusions · Draw impossible") has an error alert "With these pairs, names can't be drawn fairly. Remove Nneka Obi and Kemi Bello, or invite more people. You can still save, and the draw checks again later." with action "Remove that pair". Slice 9 built exclusions; if the built alert differs, the file is probably under `features/exclusions/`. Not a recorded change; check once.
2. **Part 3** (https://claude.ai/artifact/YaQwgPuKnzVDz27fxzFNsj) holds copies of the no-budget boards (`Org-Review-nobudget`, `Exchange-Detail-obefore-nobudget-m`, `Exchange-Detail-before-nobudget-m`, `Org-List-itemoverbudget-m`). They match the Part 2 originals by title; I did not open them to diff. Relevant to slices that handle no-budget exchanges (the S16 intro for a no-budget exchange has no board, as noted in slice 11).
3. Canvas 2 now has separate pages "02. Exchanges · organiser" and "02. Exchanges · participant". The participant page includes `Exchange-Detail-before`, `-nolist`, `Joining-In-odraws*`, `My-List-*` (S49). These are pre-draw participant boards, so no effect on slice 10 or 11 code.
