// Single entry point the UI talks to for OneDrive.
// Binds auth + Graph client + sync, tracks a coarse status for the status line,
// and debounces autosave so a field sketch is not uploaded on every keystroke.

import { createOneDriveAuth } from './onedrive-auth.js';
import { createOneDriveClient, OneDriveError } from './onedrive-client.js';
import { createOneDriveSync } from './onedrive-sync.js';
import { ONEDRIVE_CONFIG, isOneDriveConfigured } from './onedrive-config.js';

export const AUTOSAVE_DELAY_MS = 4000;

/** Every state the OneDrive status line can show. */
export const SYNC_STATUS = Object.freeze({
  unconfigured: 'unconfigured', // no Entra client id compiled in yet
  disconnected: 'disconnected',
  connecting: 'connecting',
  idle: 'idle',
  saving: 'saving',
  saved: 'saved',
  offline: 'offline',
  conflict: 'conflict',
  error: 'error',
});

export function createOneDriveService({
  config = ONEDRIVE_CONFIG,
  auth = null,
  storage = globalThis.localStorage,
  onChange = () => {},
  now = () => new Date().toISOString(),
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  fetch: fetchImpl, // injected in tests; defaults to the platform fetch
  sleep,
} = {}) {
  const authenticator = auth ?? createOneDriveAuth({ config });
  const client = createOneDriveClient({ getToken: () => authenticator.getToken(), ...(fetchImpl ? { fetch: fetchImpl } : {}), ...(sleep ? { sleep } : {}) });
  const sync = createOneDriveSync({ client, storage, now });

  let status = isOneDriveConfigured(config) ? SYNC_STATUS.disconnected : SYNC_STATUS.unconfigured;
  let detail = '';
  let account = null;
  let lastSavedAt = null;
  let conflict = null;
  let timer = null;
  let pending = null; // latest document awaiting autosave
  let inFlight = false;

  function set(next, nextDetail = '') {
    status = next;
    detail = nextDetail;
    onChange(state());
  }

  function state() {
    return {
      status, detail, lastSavedAt, conflict,
      configured: isOneDriveConfigured(config),
      connected: account !== null,
      accountName: account?.name ?? account?.username ?? null,
    };
  }

  /** Maps a thrown error onto a status the status line can explain. */
  function fail(error) {
    if (error instanceof OneDriveError && error.kind === 'offline') { set(SYNC_STATUS.offline, error.message); return; }
    if (error instanceof OneDriveError && error.kind === 'auth') { account = null; set(SYNC_STATUS.disconnected, 'Sign in to OneDrive again.'); return; }
    set(SYNC_STATUS.error, error?.message ?? 'OneDrive save failed.');
  }

  async function saveNow(document) {
    if (!account || !document) return null;
    inFlight = true;
    set(SYNC_STATUS.saving);
    try {
      const result = await sync.saveProject(document);
      if (result.status === 'conflict') {
        conflict = { document: result.document, remote: result.remote, paths: result.paths };
        set(SYNC_STATUS.conflict, 'This project also changed in OneDrive.');
        return result;
      }
      conflict = null;
      lastSavedAt = now();
      set(SYNC_STATUS.saved, result.paths.folder);
      return result;
    } catch (error) {
      fail(error);
      return null;
    } finally {
      inFlight = false;
    }
  }

  return {
    state,
    sync,
    client,
    auth: authenticator,
    isConfigured: () => isOneDriveConfigured(config),

    /** Restores an existing session without prompting, on page load. */
    async resume() {
      if (!isOneDriveConfigured(config)) return state();
      try {
        if (await authenticator.isSignedIn()) {
          account = authenticator.account();
          set(SYNC_STATUS.idle);
          if (pending) await saveNow(pending); // edits made while resuming
        }
      } catch (error) { fail(error); }
      return state();
    },

    async connect() {
      if (!isOneDriveConfigured(config)) { set(SYNC_STATUS.unconfigured, 'Add the Entra application (client) ID first.'); return state(); }
      set(SYNC_STATUS.connecting);
      try {
        account = await authenticator.signIn();
        if (!account) return state(); // redirect sign-in: the page is navigating away
        await sync.ensureBaseFolders();
        set(SYNC_STATUS.idle);
        if (pending) await saveNow(pending); // edits made before signing in
      } catch (error) { fail(error); }
      return state();
    },

    async disconnect() {
      if (timer) clearTimeoutImpl(timer);
      timer = null;
      pending = null;
      await authenticator.signOut().catch(() => null);
      account = null;
      conflict = null;
      set(SYNC_STATUS.disconnected);
      return state();
    },

    /** Debounced autosave. Safe to call on every model change. */
    scheduleSave(document) {
      // Remember the newest edit even while signed out: sign-in resumes
      // asynchronously on load, and an estimator who starts drawing straight
      // away would otherwise have that first edit reach OneDrive only on the
      // next change. connect() and resume() flush whatever is buffered here.
      pending = document;
      if (!account || !isOneDriveConfigured(config)) return;
      if (timer) clearTimeoutImpl(timer);
      timer = setTimeoutImpl(() => {
        timer = null;
        const next = pending;
        pending = null;
        if (next) saveNow(next);
      }, AUTOSAVE_DELAY_MS);
    },

    /** Immediate save, for an explicit "Save to OneDrive" action. */
    saveNow,

    /** Flushes a pending autosave, e.g. before the tab closes. */
    async flush() {
      if (timer) { clearTimeoutImpl(timer); timer = null; }
      const next = pending;
      pending = null;
      return next && !inFlight ? saveNow(next) : null;
    },

    /** Resolves a conflict by keeping the local copy. */
    async keepLocal() {
      if (!conflict) return null;
      const document = conflict.document;
      conflict = null;
      set(SYNC_STATUS.saving);
      try {
        const result = await sync.overwriteRemote(document);
        lastSavedAt = now();
        set(SYNC_STATUS.saved, result.paths.folder);
        return result;
      } catch (error) { fail(error); return null; }
    },

    /** Resolves a conflict by discarding the local copy. Returns the remote document. */
    takeRemote() {
      if (!conflict) return null;
      const remote = conflict.remote;
      conflict = null;
      set(SYNC_STATUS.idle);
      return remote;
    },

    /** Uploads one export into its dedicated folder. Never blocks the download. */
    async saveExport(document, kind, payload) {
      if (!account) return null;
      try { return await sync.saveExport(document, kind, payload); } catch (error) { fail(error); return null; }
    },

    async saveAttachment(document, kind, payload) {
      if (!account) return null;
      try { return await sync.saveAttachment(document, kind, payload); } catch (error) { fail(error); return null; }
    },

    async listProjects() {
      if (!account) return [];
      try { return await sync.listProjects(); } catch (error) { fail(error); return []; }
    },

    async openProject(folderName) {
      if (!account) return null;
      try { return await sync.openProject(folderName); } catch (error) { fail(error); return null; }
    },

    describeLocation: (document) => sync.describeLocation(document),
  };
}
