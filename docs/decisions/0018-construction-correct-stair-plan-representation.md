# ADR 0018: Construction-Correct Stair Plan Representation

Status: Accepted  
Implementation: Complete  
Date: 2026-08-17

## Context

CME correctly models one more riser than tread because the final vertical transition reaches the Deck Boundary platform. However, the current plan preview draws one interior transverse line for every tread while also using the lower stair edge and the deck interface as visible boundaries. This produces one additional visible tread band.

For example, a stair reported as four risers and three treads currently shows three interior lines plus its lower and upper boundaries, creating four visible bands. The line spacing is based on the riser count even though the displayed tread depth is calculated from total run divided by tread count. The drawing therefore does not match its own construction dimensions.

## Decision

Treat transverse stair lines in plan view as riser or nosing locations. Treat the spaces between those lines as the horizontal tread surfaces.

Preserve the construction relationship:

`riser count = tread count + 1`

Use the lower exterior stair edge as the first riser location and the selectable Deck–Stair interface as the final riser into the deck platform. Draw only the required interior riser lines:

`interior line count = tread count - 1 = riser count - 2`

Distribute the interior lines at exact tread-depth intervals across the total run. The visible tread bands, generated geometry, live preview, completed Stair object, and displayed tread-depth dimension must all describe the same spacing.

For four risers and three treads, render four total riser locations: the lower edge, two interior lines, and the deck interface. The three spaces between them are the three treads.

Do not change the existing rule that the final transition from the last tread to the deck platform counts as a riser.

## Consequences

- The plan drawing will match the physical side-view construction sequence.
- The number of visible tread surfaces will agree with the live Stair panel.
- Tread-depth dimensions will correspond to actual generated spacing.
- The Deck–Stair interface retains its construction meaning as the upper riser location and a selectable property-owning edge.
- Automated tests must verify line count, band count, exact spacing, and the relationship between total run, tread depth, risers, and treads.
