# OneDrive setup for CME

CME stores every project in the DCR OneDrive account
(`cristobal@dcrserver.onmicrosoft.com`) under a fixed folder structure. This
document covers the one-time Microsoft Entra ID registration that makes the
connection possible, and how to verify it afterwards.

Until the registration exists, CME keeps working exactly as before: projects
autosave to the device, and the project options menu shows
**OneDrive not set up**.

## Folder structure

```
CME/
├── Projects/
│   └── CME-000123 — Smith Backyard Deck/
│       ├── project.cme.json
│       ├── Exports/
│       │   ├── Plans/
│       │   ├── Takeoffs/
│       │   └── DCR Sales Hub/
│       └── Attachments/
│           ├── Photos/
│           └── Audio/
└── Templates/
    ├── Materials/
    └── Assemblies/
```

- `CME-000123` is a sequential project number assigned on the first OneDrive
  save. It is derived from the highest number already in `CME/Projects`, so two
  devices never collide, and it never changes once assigned.
- Renaming a project renames its folder; the number stays fixed.
- Folder names are sanitised for OneDrive (`" * : < > ? / \ |`, reserved device
  names, trailing dots, and over-long names are all handled).

## One-time Entra ID app registration

Do this once, signed in as an administrator of the `dcrserver.onmicrosoft.com`
tenant.

1. Open the [Azure portal](https://portal.azure.com) and go to
   **Microsoft Entra ID → App registrations → New registration**.
2. **Name**: `Construction Modeling Engine`.
3. **Supported account types**: *Accounts in this organizational directory only
   (DCR only — Single tenant)*.
4. **Redirect URI**: the registration form accepts only one. Choose platform
   **Single-page application (SPA)** — not "Web" — and enter the GitHub Pages
   URI, with its trailing slash:

   `https://barajas545.github.io/construction-modeling-engine/`

   The SPA platform is what enables the PKCE flow; picking "Web" makes Entra
   demand a client secret and sign-in fails with `AADSTS9002326`.
5. Select **Register**.
6. On the **Overview** page, copy the **Application (client) ID**.
7. Add the development URI: go to **Authentication**. Under the existing
   **Single-page application** platform select **Add URI**, enter
   `http://localhost:4173/`, and **Save**. Both URIs must now be listed under
   that one SPA platform heading.
8. Go to **API permissions → Add a permission → Microsoft Graph →
   Delegated permissions** and add:
   - `Files.ReadWrite` — read and write the signed-in user's own OneDrive
   - `User.Read` — show who is signed in (usually present already)

   Then select **Grant admin consent for DCR** so estimators are not prompted
   individually. If that button is greyed out, the account is not a Global
   Administrator — this is not a blocker for a single user, because each
   estimator can consent for themselves at first sign-in.

### Do not add a client secret

CME is a browser single-page app served from a public repository. It uses PKCE
and has no secret. Anything placed in `onedrive-config.js` ships publicly. The
client ID and tenant ID are public identifiers by design and are safe there; a
client secret is not.

## Connect CME to the registration

Put the Application (client) ID into
[`src/core/storage/onedrive-config.js`](../../src/core/storage/onedrive-config.js):

```js
export const ONEDRIVE_CONFIG = {
  clientId: '00000000-0000-0000-0000-000000000000', // <- paste it here
  tenantId: 'dcrserver.onmicrosoft.com',
  ...
};
```

Commit and deploy. The project options menu will then offer
**Connect OneDrive**.

### Current DCR tenant state (2026-09-22)

The registration exists and is wired up. Admin consent was deliberately **not**
granted: with one user, each estimator consenting for themselves at first
sign-in is more transparent. If CME is rolled out to a field crew, grant admin
consent then so nobody sees a consent prompt.

## Verify

1. Open CME and click the project name in the top bar.
2. Select **Connect OneDrive** and sign in as
   `cristobal@dcrserver.onmicrosoft.com`.
3. The status line should read **OneDrive · Cristobal**, and `CME/Projects` plus
   `CME/Templates/Materials` and `CME/Templates/Assemblies` should now exist in
   OneDrive.
4. Draw a deck boundary. Within a few seconds the status line should read
   **Saved to OneDrive**, and `CME/Projects/CME-000001 — <project name>/project.cme.json`
   should exist.

## What gets stored where

| Content | Destination | Trigger |
| --- | --- | --- |
| Project model | `project.cme.json` | Autosave, ~4s after the last edit |
| Sketch plan | `Exports/Plans/` | **Export PDF** — files the sketch as SVG |
| Takeoff | `Exports/Takeoffs/` | **Takeoff JSON** download |
| Step 1 payload | `Exports/DCR Sales Hub/` | **Save to Step 1** and Step 1 JSON download |
| Reference project | `Exports/DCR Sales Hub/` | **Export as reference project** |

Exports are timestamped (`2026-09-22-1431-takeoff.json`) and never overwrite an
earlier export.

### Known gaps

- **Plans holds an SVG, not the PDF.** The PDF is produced by the browser's own
  print dialog, which a page cannot capture. The vector sketch is filed instead.
- **`Attachments/Photos/` is provisioned but unused.** CME has no photo-capture
  feature yet; the folder and the upload path are ready for one.
- **CAT voice notes stay embedded** in `project.cme.json` as data URLs.
  `Attachments/Audio/` is provisioned and `saveAttachment` supports it, but
  moving existing notes out of the document needs a schema migration.

## Behaviour worth knowing

- **The device copy is always written first.** OneDrive is a mirror, never the
  only copy. Losing connectivity mid-visit shows *Offline · saved on this
  device* and never loses a sketch.
- **Concurrent edits are detected, not silently resolved.** Every write is
  conditional on the version CME last read (an HTTP `if-match` on the file's
  eTag). If another device saved in between, CME reports the conflict and asks
  which copy to keep. A refused save leaves OneDrive completely untouched.
- **Sign-in is per browser session.** Tokens are held in `sessionStorage`, which
  suits a shared field tablet: closing the browser ends the session.
- **Sign-in tries a popup, then falls back to a full-page redirect.** Tablets
  and embedded browsers routinely block popups. On the redirect path the page
  navigates to Microsoft and returns signed in; the project is already saved on
  the device, so nothing is lost crossing that boundary.
- **The first save of a project costs a handful of requests; later autosaves
  cost one.** The folder layout is provisioned once and remembered, which keeps
  a field connection usable.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `AADSTS9002326` — cross-origin token redemption | The redirect URI is registered under **Web** instead of **Single-page application**. Re-add it under the SPA platform. |
| `AADSTS50011` — redirect URI mismatch | The URI in the registration must match the address bar exactly, trailing slash included. |
| Sign-in popup blocked | Handled automatically: CME falls back to a full-page redirect. Allow popups for the CME origin only if you prefer the popup flow. |
| `Failed to resolve module specifier "@azure/msal-common/browser"` | `msalUrl` points at a build with bare imports. It must use jsdelivr's `+esm` endpoint, which bundles the dependency. |
| *OneDrive not set up* after deploying | `clientId` is still empty in `onedrive-config.js`. |
| Sign-in succeeds, saves fail with a permission error | `Files.ReadWrite` is missing, or admin consent was not granted. |
