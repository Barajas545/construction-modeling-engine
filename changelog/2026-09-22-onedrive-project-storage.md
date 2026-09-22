# OneDrive project storage

- CME projects now sync to the DCR OneDrive account under a fixed `CME/` structure: `Projects/CME-000123 — Name/` holding `project.cme.json`, `Exports/{Plans,Takeoffs,DCR Sales Hub}/`, and `Attachments/{Photos,Audio}/`, alongside `Templates/{Materials,Assemblies}/`.
- Projects receive a sequential DCR project number (`CME-000123`) on their first OneDrive save, derived from the highest number already present so two devices cannot collide. The number is fixed for the life of the project; renaming a project renames its folder only.
- Device storage remains authoritative. Every edit is written to `localStorage` first and mirrored to OneDrive on a 4-second debounce, so losing connectivity mid-visit reports *Offline · saved on this device* rather than losing a sketch.
- Writes are conditional on the version CME last read. When another device saved in between, the estimator is asked which copy to keep; a refused save leaves OneDrive entirely untouched, including the folder name.
- Takeoff, Step 1, and reference-project exports are filed in their own folders with timestamped names and never overwrite an earlier export. Export PDF files the sketch under `Exports/Plans/` as vector SVG, because the PDF itself is produced by the browser print dialog and cannot be captured by the page.
- Sign-in uses Microsoft Entra ID with PKCE through MSAL Browser, loaded from a CDN because CME has no build step. Tokens are held in `sessionStorage`, which suits a shared field tablet. A blocked popup falls back to a full-page redirect, since tablets and embedded browsers routinely refuse popups.
- `project.cme.json` is written before the `Exports` and `Attachments` tree is laid out, so an interrupted first save cannot leave a numbered folder that holds no project. The layout is provisioned once per project rather than on every save, which reduces a repeat autosave to a single request; a project folder deleted in OneDrive is rebuilt on the next save instead of losing the edit.
- Edits made before sign-in finishes resuming are buffered and synced as soon as the connection is established, rather than waiting for the next change.

Storage sits behind an explicit adapter boundary in `src/core/storage/`: path derivation, the Graph client, sync orchestration, and auth are separate modules, each injectable and tested without network access. Nothing in the modeling tools depends on OneDrive.

The integration is inert until an Entra application (client) ID is added to `src/core/storage/onedrive-config.js`; until then CME behaves exactly as before and reports *OneDrive not set up*. Registration steps are in `docs/integrations/OneDrive-Setup.md`.

`Attachments/Photos/` is provisioned but unused — CME has no photo-capture feature yet. CAT voice notes remain embedded in `project.cme.json` as data URLs; moving them into `Attachments/Audio/` needs a schema migration.
