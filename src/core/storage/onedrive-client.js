// Microsoft Graph wrapper for the CME OneDrive store.
// `fetch` and the token provider are injected so every branch is testable offline.

import { exceedsPathLimit } from './onedrive-paths.js';

export const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
export const SMALL_FILE_LIMIT = 4 * 1024 * 1024; // Graph's simple-upload ceiling
export const UPLOAD_CHUNK_SIZE = 5 * 320 * 1024; // must be a multiple of 320 KiB
const MAX_RETRIES = 3;

/** Thrown for every Graph failure so callers can branch on `kind` rather than status text. */
export class OneDriveError extends Error {
  constructor(message, { status = 0, kind = 'unknown', path = null, cause = null } = {}) {
    super(message);
    this.name = 'OneDriveError';
    this.status = status;
    this.kind = kind;
    this.path = path;
    this.cause = cause;
  }
}

function classify(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'missing';
  if (status === 409) return 'conflict';
  if (status === 412) return 'precondition'; // eTag mismatch: someone else saved first
  if (status === 413) return 'too-large';
  if (status === 429 || status === 507) return 'throttled';
  if (status >= 500) return 'server';
  return 'request';
}

const isRetryable = (kind) => kind === 'throttled' || kind === 'server';

/** Encodes each path segment but keeps the `/` separators Graph needs. */
export function encodeDrivePath(path) {
  return String(path).split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

/** Builds a Graph drive-item URL addressed by path rather than by item id. */
export function driveItemUrl(path, suffix = '', { baseUrl = GRAPH_BASE_URL, driveRoot = '/me/drive/root' } = {}) {
  const encoded = encodeDrivePath(path);
  if (encoded === '') return `${baseUrl}${driveRoot}${suffix ? `/${suffix}` : ''}`;
  return `${baseUrl}${driveRoot}:/${encoded}:${suffix ? `/${suffix}` : ''}`;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates the Graph client.
 * @param getToken async () => access token string
 * @param fetchImpl injected for tests; defaults to the platform fetch
 * @param sleep injected so retry backoff is instant under test
 */
export function createOneDriveClient({ getToken, fetch: fetchImpl = globalThis.fetch, baseUrl = GRAPH_BASE_URL, driveRoot = '/me/drive/root', sleep = delay } = {}) {
  if (typeof getToken !== 'function') throw new Error('createOneDriveClient requires a getToken function.');
  if (typeof fetchImpl !== 'function') throw new Error('createOneDriveClient requires a fetch implementation.');

  async function request(url, { method = 'GET', headers = {}, body, expect = 'json', path = null, retries = MAX_RETRIES } = {}) {
    let attempt = 0;
    for (;;) {
      const token = await getToken();
      let response;
      try {
        response = await fetchImpl(url, { method, body, headers: { Authorization: `Bearer ${token}`, ...headers } });
      } catch (cause) {
        // Offline or DNS failure: retry like a server error so field work survives a dead spot.
        if (attempt++ < retries) { await sleep(2 ** attempt * 250); continue; }
        throw new OneDriveError('OneDrive is unreachable. The project stayed saved on this device.', { kind: 'offline', path, cause });
      }
      if (response.ok) {
        if (expect === 'none' || response.status === 204) return null;
        if (expect === 'blob') return response.blob();
        if (expect === 'text') return response.text();
        return response.json();
      }
      const kind = classify(response.status);
      if (isRetryable(kind) && attempt++ < retries) {
        const retryAfter = Number(response.headers?.get?.('Retry-After'));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250);
        continue;
      }
      throw new OneDriveError(await describe(response, kind), { status: response.status, kind, path });
    }
  }

  async function describe(response, kind) {
    let detail = '';
    try { detail = (await response.json())?.error?.message ?? ''; } catch { /* non-JSON error body */ }
    const prefix = {
      auth: 'OneDrive rejected the sign-in',
      missing: 'That OneDrive item no longer exists',
      conflict: 'A OneDrive item with that name already exists',
      precondition: 'This project changed in OneDrive since it was opened',
      'too-large': 'That file is too large for OneDrive',
      throttled: 'OneDrive is throttling requests',
      server: 'OneDrive had a server error',
    }[kind] ?? 'OneDrive request failed';
    return detail ? `${prefix}: ${detail}` : `${prefix} (HTTP ${response.status}).`;
  }

  const url = (path, suffix) => driveItemUrl(path, suffix, { baseUrl, driveRoot });

  async function getItem(path) {
    try { return await request(url(path), { path }); } catch (error) {
      if (error instanceof OneDriveError && error.kind === 'missing') return null;
      throw error;
    }
  }

  /** Creates one folder under `parentPath`, tolerating a concurrent creation. */
  async function createFolder(parentPath, name) {
    const target = parentPath ? `${parentPath}/${name}` : name;
    if (exceedsPathLimit(target)) throw new OneDriveError('That OneDrive path is too long.', { kind: 'request', path: target });
    return request(url(parentPath, 'children'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // "fail" then treat 409 as success, so two devices creating the same folder converge.
      body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }),
      path: target,
    }).catch(async (error) => {
      if (error instanceof OneDriveError && error.kind === 'conflict') return getItem(target);
      throw error;
    });
  }

  /** Ensures every folder along `path` exists, creating only what is missing. */
  async function ensureFolderPath(path) {
    const segments = String(path).split('/').filter(Boolean);
    let walked = '';
    let item = null;
    for (const segment of segments) {
      const next = walked ? `${walked}/${segment}` : segment;
      item = await getItem(next);
      if (!item) item = await createFolder(walked, segment);
      else if (!item.folder) throw new OneDriveError(`A file already occupies ${next}.`, { kind: 'conflict', path: next });
      walked = next;
    }
    return item;
  }

  /**
   * Uploads content under `path`. Pass `eTag` to make the write conditional —
   * a 412 then means another device saved first and the caller must resolve it.
   */
  async function putFile(path, content, { contentType = 'application/octet-stream', eTag = null, conflictBehavior = 'replace' } = {}) {
    if (exceedsPathLimit(path)) throw new OneDriveError('That OneDrive path is too long.', { kind: 'request', path });
    const size = content?.size ?? content?.byteLength ?? (typeof content === 'string' ? new TextEncoder().encode(content).byteLength : 0);
    if (size > SMALL_FILE_LIMIT) return putLargeFile(path, content, { contentType, conflictBehavior });
    const headers = { 'Content-Type': contentType };
    if (eTag) headers['if-match'] = eTag;
    return request(`${url(path, 'content')}?%40microsoft.graph.conflictBehavior=${encodeURIComponent(conflictBehavior)}`, {
      method: 'PUT', headers, body: content, path,
    });
  }

  /** Chunked upload session for anything over Graph's simple-upload ceiling. */
  async function putLargeFile(path, content, { contentType = 'application/octet-stream', conflictBehavior = 'replace', onProgress } = {}) {
    const session = await request(url(path, 'createUploadSession'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': conflictBehavior } }),
      path,
    });
    const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
    const total = blob.size;
    let uploaded = 0;
    let result = null;
    while (uploaded < total) {
      const end = Math.min(uploaded + UPLOAD_CHUNK_SIZE, total);
      const chunk = blob.slice(uploaded, end);
      // The upload URL is pre-authorized; sending a bearer token with it is rejected.
      const response = await fetchImpl(session.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Length': String(end - uploaded), 'Content-Range': `bytes ${uploaded}-${end - 1}/${total}` },
        body: chunk,
      });
      if (!response.ok) throw new OneDriveError(`Chunk upload failed (HTTP ${response.status}).`, { status: response.status, kind: classify(response.status), path });
      uploaded = end;
      onProgress?.({ uploaded, total });
      if (response.status === 200 || response.status === 201) result = await response.json();
    }
    return result;
  }

  return {
    request,
    getItem,
    ensureFolderPath,
    createFolder,
    putFile,
    putLargeFile,
    /** Lists child items, following Graph paging to completion. */
    async listChildren(path) {
      const items = [];
      let next = `${url(path, 'children')}?$top=200&$select=id,name,folder,file,size,eTag,lastModifiedDateTime`;
      while (next) {
        const page = await request(next, { path });
        items.push(...(page.value ?? []));
        next = page['@odata.nextLink'] ?? null;
      }
      return items;
    },
    /** Reads a file as text. Returns null when it does not exist. */
    async readFile(path) {
      try {
        return await request(url(path, 'content'), { expect: 'text', path });
      } catch (error) {
        if (error instanceof OneDriveError && error.kind === 'missing') return null;
        throw error;
      }
    },
    /** Reads a JSON file plus its eTag, so the caller can write back conditionally. */
    async readJsonWithETag(path) {
      const item = await getItem(path);
      if (!item) return null;
      const text = await request(url(path, 'content'), { expect: 'text', path });
      return { eTag: item.eTag ?? null, item, value: JSON.parse(text) };
    },
    async deleteItem(path) {
      return request(url(path), { method: 'DELETE', expect: 'none', path });
    },
    /** Renames an item in place, keeping its id, children, and sharing links. */
    async renameItem(path, newName) {
      return request(url(path), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }), path,
      });
    },
  };
}
