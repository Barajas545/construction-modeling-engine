# Stair framing takeoff

Implemented on 2026-08-25.

## Product behavior

- Every staircase derives two side stringers plus internal stringers at 12 inches O.C. maximum.
- All stringers and the top stair ledger/header use 2×12 PT by default.
- Stringer length follows the true stair slope from total run and total rise.
- Each stringer is assigned the shortest continuous commercial stock length among 8, 10, 12, 16, and 20 feet.
- Stringers longer than 20 feet remain visible as REVIEW items and are never represented as safely spliced.
- The header is measured from stair width and planned into commercial stock.
- Stair selection displays framing count, actual spacing, slope length, and purchase stock.
- Detailed Takeoff preserves Stair Stringer and Stair Ledger/Header roles under Framing; Consolidated Purchasing groups matching 2×12 PT stock for purchasing.

## Calculation example

A 36-inch-wide stair produces four stringers: two sides and two internal supports, yielding 12-inch actual spacing. The result updates whenever stair width, total run, or total rise changes.

## Scope

This iteration calculates primary 2×12 PT stair framing. Connectors, fasteners, bottom bearing details, blocking, and local structural approval remain future estimating rules.
