// OneDrive connection settings for the DCR tenant.
//
// These are NOT secrets. A browser single-page app uses PKCE and has no client
// secret; the client id and tenant id are public by design. Never add a client
// secret here — this file ships to a public GitHub Pages site.
//
// Fill `clientId` in after registering the app. See:
// docs/integrations/OneDrive-Setup.md

export const ONEDRIVE_CONFIG = {
  // Application (client) ID from the Entra ID app registration.
  clientId: 'e2256a4f-3744-4c64-82c2-4faff888217f',

  // Single-tenant: only dcrserver.onmicrosoft.com accounts can sign in.
  // Tenant (directory) ID: d874943f-897f-4486-8d95-d95cf620e041
  tenantId: 'dcrserver.onmicrosoft.com',

  // Delegated Graph scopes. Files.ReadWrite covers the signed-in user's own
  // OneDrive, which is where CME/ lives. User.Read supplies the display name.
  scopes: ['Files.ReadWrite', 'User.Read'],

  // MSAL Browser, loaded at runtime because this project has no build step.
  // The `+esm` endpoint is required: it bundles msal-common and rewrites the
  // bare import specifiers that dist/index.mjs ships with, which a browser
  // cannot resolve without an import map. Pinned so a CDN release cannot
  // change sign-in behaviour underneath a field tablet.
  msalUrl: 'https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.30.0/+esm',
};

/** The redirect URI must match the app registration exactly, path included. */
export function defaultRedirectUri(location = globalThis.location) {
  if (!location) return '';
  const path = location.pathname.replace(/\/[^/]*$/, '/');
  return `${location.origin}${path}`;
}

/** True once the app registration id has been filled in. */
export function isOneDriveConfigured(config = ONEDRIVE_CONFIG) {
  return typeof config.clientId === 'string' && config.clientId.trim() !== '';
}
