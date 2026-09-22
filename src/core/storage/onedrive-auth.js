// Microsoft Entra ID sign-in for OneDrive, via MSAL Browser.
//
// MSAL is imported at runtime from a CDN because CME has no build step. The
// loader is injectable so tests never touch the network, and so the Portal can
// substitute its own token source behind the same interface.

import { ONEDRIVE_CONFIG, defaultRedirectUri, isOneDriveConfigured } from './onedrive-config.js';

let msalModulePromise = null;

/** Loads MSAL Browser once per page. */
function loadMsal(url) {
  msalModulePromise ??= import(/* @vite-ignore */ url);
  return msalModulePromise;
}

/**
 * Creates the auth adapter. Anything that can produce a Graph access token can
 * stand in for this: the sync layer only needs `getToken`.
 *
 * @param config      overrides for ONEDRIVE_CONFIG
 * @param loader      injected MSAL loader, for tests
 */
export function createOneDriveAuth({ config = ONEDRIVE_CONFIG, loader = loadMsal, redirectUri = null } = {}) {
  const settings = { ...ONEDRIVE_CONFIG, ...config };
  let client = null;
  let account = null;

  async function instance() {
    if (client) return client;
    if (!isOneDriveConfigured(settings)) {
      throw new Error('OneDrive is not configured yet. Add the Entra application (client) ID to src/core/storage/onedrive-config.js.');
    }
    const msal = await loader(settings.msalUrl);
    client = new msal.PublicClientApplication({
      auth: {
        clientId: settings.clientId,
        authority: `https://login.microsoftonline.com/${settings.tenantId}`,
        redirectUri: redirectUri ?? defaultRedirectUri(),
      },
      // sessionStorage keeps the token out of other tabs and clears on close,
      // which suits a shared field tablet better than localStorage.
      cache: { cacheLocation: 'sessionStorage', storeAuthStateInCookie: false },
    });
    await client.initialize();
    // Completes a redirect sign-in when the page comes back from Microsoft.
    const redirected = await client.handleRedirectPromise().catch(() => null);
    account = redirected?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null;
    if (account) client.setActiveAccount(account);
    return client;
  }

  // Popups are blocked on most tablets and inside embedded browsers. These are
  // the MSAL codes that mean "the popup never opened" — as opposed to the user
  // deliberately closing it, which must not trigger a surprise page redirect.
  const POPUP_UNAVAILABLE = new Set(['popup_window_error', 'empty_window_error', 'popup_window_unavailable']);
  const popupUnavailable = (error) => POPUP_UNAVAILABLE.has(error?.errorCode) || /popup_window_error|Error opening popup/i.test(error?.message ?? '');

  return {
    /** True when an account is already signed in on this device. */
    async isSignedIn() {
      await instance();
      return account !== null;
    },

    account: () => account,

    /**
     * Signs in via popup, falling back to a full-page redirect when the
     * browser will not open one. The redirect navigates away and returns
     * signed in; the device copy of the project is already persisted.
     */
    async signIn() {
      const app = await instance();
      try {
        const result = await app.loginPopup({ scopes: settings.scopes, prompt: 'select_account' });
        account = result.account;
        app.setActiveAccount(account);
        return account;
      } catch (error) {
        if (!popupUnavailable(error)) throw error;
        await app.loginRedirect({ scopes: settings.scopes });
        return null; // navigation is in flight; the page returns signed in
      }
    },

    async signOut() {
      const app = await instance();
      const current = account;
      account = null;
      if (current) await app.logoutPopup({ account: current }).catch(() => null);
    },

    /**
     * Returns a Graph access token, renewing silently when possible and only
     * prompting when Entra says interaction is genuinely required.
     */
    async getToken() {
      const app = await instance();
      if (!account) await this.signIn();
      try {
        const result = await app.acquireTokenSilent({ scopes: settings.scopes, account });
        return result.accessToken;
      } catch {
        try {
          const result = await app.acquireTokenPopup({ scopes: settings.scopes, account });
          account = result.account ?? account;
          return result.accessToken;
        } catch (error) {
          if (!popupUnavailable(error)) throw error;
          await app.acquireTokenRedirect({ scopes: settings.scopes, account });
          return null; // navigation is in flight
        }
      }
    },

    configured: () => isOneDriveConfigured(settings),
  };
}
