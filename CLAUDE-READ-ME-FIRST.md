# Claude — Read This First

This folder is the current independent Construction Modeling Engine (CME) development source. It contains local work that is newer than the CME version currently integrated into DCR Framing Portal.

## Primary handoff document

Read [`docs/integrations/CME-DCR-Portal-Handoff.md`](docs/integrations/CME-DCR-Portal-Handoff.md) before comparing or porting code. That Markdown file is the maintained handoff document.

Do **not** use `CME-Instructions-for-Claude.pdf` as the source of truth. The PDF is an older snapshot retained only as an archive. Markdown, source code, changelog entries, and automated tests supersede it.

## Source-of-truth order

1. Current source and automated tests in this delivered folder.
2. `docs/integrations/CME-DCR-Portal-Handoff.md`.
3. Dated entries under `changelog/`.
4. Module README files under `src/tools/` and shared architecture under `src/core/`.
5. The old PDF only for historical reference.

Do not infer requirements from conversation history, and do not reset or replace this working folder before reviewing uncommitted work.

## Most recent local changes — 2026-09-22

- Projects sync to the DCR OneDrive account under `CME/Projects/CME-000123 — Name/`, with `Exports/{Plans,Takeoffs,DCR Sales Hub}/`, `Attachments/{Photos,Audio}/`, and `CME/Templates/{Materials,Assemblies}/`.
- Storage lives behind an adapter boundary in `src/core/storage/` (paths, Graph client, sync, auth, service), each module injectable and tested with no network.
- Device storage stays authoritative; OneDrive follows on a debounce. Conditional writes surface concurrent edits instead of overwriting them.
- Inert until an Entra application (client) ID is set in `src/core/storage/onedrive-config.js` — see `docs/integrations/OneDrive-Setup.md`.

Detail: `changelog/2026-09-22-onedrive-project-storage.md`.

## Earlier local changes — 2026-09-01

- CAT construction lines can become circular arcs.
- CAT Offset supports live/typed distance, Repeat Offset, adjacent joined offsets, and concentric arc offsets.
- CAT Trim and two-stage Extend support straight lines and arcs.
- Closed CAT loops derive selectable orange CAT Boundaries and can convert to Deck Boundaries while preserving curves.
- Curved Deck Boundary edges can define a concentric curved Deck Boarding Direction pattern.
- Deck and CAT area annotations can hide one boundary or show all boundaries without deleting geometry.
- CAT Boundary area labels have connected, repositionable leaders.
- Selected CAT arcs show radius, chord-midpoint height, and midpoint nodes in CAT colors.

Detailed behavior and compatibility notes:

- `changelog/2026-09-01-cat-arcs-offset-boundaries.md`
- `changelog/2026-09-01-curved-deck-boarding.md`
- `changelog/2026-09-01-boundary-area-controls-and-cat-arc-dimensions.md`

## Integration rules

- Keep CME independent from DCR Sales Hub and DCR Framing Portal.
- Port isolated domain modules and serializable data contracts; do not copy the complete CME UI into the Portal.
- Keep Portal routing, authentication, storage, and global styles behind an explicit adapter boundary.
- Preserve all older framing, railing, stairs, Takeoff, curved-boundary, and project-export behavior described in the primary handoff.
- Treat tests as behavioral contracts. Add Portal integration tests for any promoted capability.

## Validation before promotion

From the project root, run:

```text
npm test
npm run build
```

Then compare the Portal implementation against the dated changelog entries and complete the acceptance checklist in the primary handoff document.

