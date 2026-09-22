// Orchestrates CME project storage in OneDrive.
// Owns project numbering, folder provisioning, conditional writes, and rename
// tracking. Device-local storage stays authoritative until a write succeeds, so
// a dead spot in the field never loses a sketch.

import { serializeProject, parseProject } from '../document/project-document.js';
import { OneDriveError } from './onedrive-client.js';
import {
  ATTACHMENT_KINDS, EXPORT_KINDS, PROJECT_FILE, baseFolderPaths, formatProjectNumber,
  nextProjectNumber, parseProjectFolderName, projectFolderName, projectPaths,
  projectPathsFromFolderName, projectsRootPath, timestampedFileName,
} from './onedrive-paths.js';

export const SYNC_STATE_STORAGE_KEY = 'cme.onedrive.sync-state.v1';

/** Per-project sync bookkeeping kept out of the project document itself. */
function emptyState() { return { projects: {} }; }

export function readSyncState(storage) {
  try {
    const raw = storage?.getItem?.(SYNC_STATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.projects && typeof parsed.projects === 'object' ? parsed : emptyState();
  } catch { return emptyState(); }
}

export function writeSyncState(storage, state) {
  try { storage?.setItem?.(SYNC_STATE_STORAGE_KEY, JSON.stringify(state)); } catch { /* quota or private mode */ }
}

/**
 * @param client       a createOneDriveClient() instance
 * @param storage      localStorage-like, for eTag/folder bookkeeping
 * @param now          injected clock
 */
export function createOneDriveSync({ client, storage = globalThis.localStorage, now = () => new Date().toISOString() } = {}) {
  if (!client) throw new Error('createOneDriveSync requires a OneDrive client.');
  let state = readSyncState(storage);
  let baseFoldersReady = false;

  const entry = (projectId) => state.projects[projectId] ?? null;
  function remember(projectId, patch) {
    state = { ...state, projects: { ...state.projects, [projectId]: { ...(state.projects[projectId] ?? {}), ...patch } } };
    writeSyncState(storage, state);
    return state.projects[projectId];
  }

  /** Creates CME/, Projects/, Templates/ and the template subfolders once per session. */
  async function ensureBaseFolders() {
    if (baseFoldersReady) return;
    for (const path of baseFolderPaths()) await client.ensureFolderPath(path);
    baseFoldersReady = true;
  }

  /** Folder names already present under CME/Projects. */
  async function listProjectFolders() {
    await ensureBaseFolders();
    const children = await client.listChildren(projectsRootPath());
    return children.filter((child) => child.folder).map((child) => child.name);
  }

  /**
   * Assigns the next sequential number the first time a project is saved.
   * Reuses the stored number afterwards so the folder never moves.
   */
  async function claimProjectNumber(document) {
    if (Number.isInteger(document.projectNumber) && document.projectNumber > 0) return document.projectNumber;
    const remembered = entry(document.id)?.projectNumber;
    if (Number.isInteger(remembered) && remembered > 0) return remembered;
    return nextProjectNumber(await listProjectFolders());
  }

  /**
   * Renames the project folder so it tracks the current project name while the
   * number stays fixed. Only ever called after a successful write, so a
   * rejected save never leaves the drive rearranged.
   */
  async function renameProjectFolder(from, to) {
    if (from === to) return to;
    try {
      await client.renameItem(`${projectsRootPath()}/${from}`, to);
    } catch (error) {
      // A missing source folder just means this device never wrote it; a name
      // clash means another device already renamed it. Both are recoverable.
      if (!(error instanceof OneDriveError) || !['missing', 'conflict'].includes(error.kind)) throw error;
    }
    return to;
  }

  /**
   * Writes project.cme.json and provisions the project folder tree.
   * Returns `{ status: 'saved' | 'conflict', document, paths, remote? }`.
   *
   * The write is attempted at the folder OneDrive currently holds, and the
   * folder is renamed only once that write succeeds. A conflict therefore
   * leaves OneDrive exactly as it was, for the caller to resolve.
   */
  async function saveProject(document, { force = false } = {}) {
    await ensureBaseFolders();
    const projectNumber = await claimProjectNumber(document);
    const desiredFolderName = projectFolderName(projectNumber, document.name);
    const known = entry(document.id);
    const currentFolderName = known?.folderName ?? desiredFolderName;
    const current = projectPathsFromFolderName(currentFolderName);
    // Only the project folder itself, so the document is written as early as
    // possible. Provisioning the whole subfolder tree first means an
    // interrupted save leaves an empty folder that owns a project number but
    // holds no project. A project already known to exist skips the folder walk
    // entirely, so a repeat autosave costs one request on a field connection.
    const alreadyProvisioned = known?.provisioned === true;
    if (!alreadyProvisioned) await client.ensureFolderPath(current.folder);

    const stamped = { ...document, projectNumber, updatedAt: document.updatedAt ?? now() };
    const eTag = force ? null : known?.eTag ?? null;
    const write = () => client.putFile(current.projectFile, serializeProject(stamped), { contentType: 'application/json', eTag });

    let item;
    try {
      item = await write();
    } catch (error) {
      if (error instanceof OneDriveError && error.kind === 'precondition') {
        // Someone else saved this project since we last read it. Report it and
        // change nothing: the caller decides whose copy wins.
        const remote = await client.readJsonWithETag(current.projectFile);
        return { status: 'conflict', document: stamped, paths: current, remote: remote?.value ?? null, remoteETag: remote?.eTag ?? null };
      }
      // The folder may have been moved or deleted in OneDrive since the last
      // save. Rebuild it and write again rather than losing the edit.
      if (!(alreadyProvisioned && error instanceof OneDriveError && error.kind === 'missing')) throw error;
      await client.ensureFolderPath(current.folder);
      item = await write();
    }

    const folderName = await renameProjectFolder(currentFolderName, desiredFolderName);
    const paths = projectPathsFromFolderName(folderName);
    // A rename issues a new eTag, so re-read it rather than trusting the write's.
    const settledETag = folderName === currentFolderName
      ? item?.eTag ?? null
      : (await client.getItem(paths.projectFile))?.eTag ?? null;

    // The document is stored; now lay out the Exports and Attachments folders
    // so the project reads correctly in OneDrive. Done once per project rather
    // than on every autosave — saveExport and saveAttachment ensure their own
    // folder anyway, so this is for discoverability, not correctness.
    let provisioned = known?.provisioned === true && folderName === currentFolderName;
    if (!provisioned) {
      try {
        for (const folder of paths.subfolders) await client.ensureFolderPath(folder);
        provisioned = true;
      } catch { /* The project itself is saved; folders retry on the next save. */ }
    }

    remember(document.id, { projectNumber, folderName, eTag: settledETag, lastSyncedAt: now(), path: paths.projectFile, provisioned });
    return { status: 'saved', document: stamped, paths, item };
  }

  return {
    ensureBaseFolders,
    listProjectFolders,
    claimProjectNumber,
    saveProject,
    syncState: () => state,
    projectState: entry,

    /** Resolves a conflict by writing our copy over the remote one. */
    async overwriteRemote(document) { return saveProject(document, { force: true }); },

    /** Lists every CME project stored in OneDrive, newest first. */
    async listProjects() {
      await ensureBaseFolders();
      const folders = (await client.listChildren(projectsRootPath())).filter((child) => child.folder);
      return folders
        .map((folder) => ({ ...parseProjectFolderName(folder.name), folderName: folder.name, lastModified: folder.lastModifiedDateTime ?? null }))
        .filter((folder) => Number.isInteger(folder.number))
        .sort((a, b) => b.number - a.number);
    },

    /** Reads one project document back out of OneDrive. */
    async openProject(folderName) {
      const path = `${projectsRootPath()}/${folderName}/${PROJECT_FILE}`;
      const remote = await client.readJsonWithETag(path);
      if (!remote) return null;
      const document = parseProject(JSON.stringify(remote.value));
      remember(document.id, {
        projectNumber: document.projectNumber ?? parseProjectFolderName(folderName)?.number ?? null,
        folderName, eTag: remote.eTag, lastSyncedAt: now(), path,
      });
      return document;
    },

    /**
     * Writes one export (plan PDF, takeoff JSON, Sales Hub payload) into its
     * dedicated folder. Exports are timestamped, never overwritten.
     */
    async saveExport(document, kind, { content, extension, contentType, fileName, prefix } = {}) {
      if (!EXPORT_KINDS[kind]) throw new Error(`Unsupported CME export destination: ${kind}`);
      const projectNumber = await claimProjectNumber(document);
      const paths = projectPaths(projectNumber, document.name);
      await client.ensureFolderPath(paths.exports[kind]);
      const name = fileName ?? timestampedFileName(prefix ?? kind, extension ?? 'json', now());
      const item = await client.putFile(`${paths.exports[kind]}/${name}`, content, {
        contentType: contentType ?? 'application/octet-stream',
        conflictBehavior: 'rename',
      });
      return { path: `${paths.exports[kind]}/${name}`, item };
    },

    /** Writes one field attachment (site photo or voice note). */
    async saveAttachment(document, kind, { content, extension, contentType, fileName, prefix } = {}) {
      if (!ATTACHMENT_KINDS[kind]) throw new Error(`Unsupported CME attachment destination: ${kind}`);
      const projectNumber = await claimProjectNumber(document);
      const paths = projectPaths(projectNumber, document.name);
      await client.ensureFolderPath(paths.attachments[kind]);
      const name = fileName ?? timestampedFileName(prefix ?? kind, extension ?? 'bin', now());
      const item = await client.putFile(`${paths.attachments[kind]}/${name}`, content, {
        contentType: contentType ?? 'application/octet-stream',
        conflictBehavior: 'rename',
      });
      return { path: `${paths.attachments[kind]}/${name}`, item };
    },

    /** Human-readable location, for status text in the UI. */
    describeLocation(document) {
      const projectNumber = document.projectNumber ?? entry(document.id)?.projectNumber ?? null;
      if (!projectNumber) return null;
      return { number: formatProjectNumber(projectNumber), ...projectPaths(projectNumber, document.name) };
    },
  };
}
