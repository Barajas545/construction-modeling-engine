// An in-memory stand-in for the Microsoft Graph drive endpoints CME uses.
// Lets the client and sync layers be tested end to end with no network.

export function createFakeDrive({ files = {}, folders = ['CME'] } = {}) {
  const drive = {
    folders: new Set(folders),
    files: new Map(Object.entries(files).map(([path, value]) => [path, { content: value, eTag: '"1"' }])),
    requests: [],
    failures: [], // queued { match, status, body } responses, consumed in order
  };

  const json = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });

  // "https://graph.microsoft.com/v1.0/me/drive/root:/CME/Projects:/children" -> "CME/Projects"
  function decodePath(url) {
    const match = /\/me\/drive\/root(?::\/(.*?):)?(?:\/(children|content|createUploadSession))?(?:\?|$)/.exec(url);
    return { path: match?.[1] ? decodeURIComponent(match[1]).split('/').map(decodeURIComponent).join('/') : '', verb: match?.[2] ?? null };
  }

  const item = (path, extra = {}) => ({
    id: `id:${path}`, name: path.split('/').pop(), eTag: drive.files.get(path)?.eTag ?? '"1"', ...extra,
  });

  async function fetchImpl(url, options = {}) {
    const method = options.method ?? 'GET';
    const { path, verb } = decodePath(String(url));
    drive.requests.push({ method, path, verb, url: String(url) });

    const queued = drive.failures.find((failure) => failure.match(method, path, verb));
    if (queued) {
      drive.failures.splice(drive.failures.indexOf(queued), 1);
      return json(queued.status, queued.body ?? { error: { message: 'failed' } }, queued.headers ?? {});
    }

    if (method === 'GET' && verb === 'children') {
      if (!drive.folders.has(path)) return json(404, { error: { message: 'not found' } });
      const prefix = `${path}/`;
      const children = [
        ...[...drive.folders].filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'))
          .map((f) => item(f, { folder: { childCount: 0 }, name: f.slice(prefix.length) })),
        ...[...drive.files.keys()].filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'))
          .map((f) => item(f, { file: {}, name: f.slice(prefix.length) })),
      ];
      return json(200, { value: children });
    }

    if (method === 'GET' && verb === 'content') {
      const file = drive.files.get(path);
      return file ? json(200, file.content) : json(404, { error: { message: 'not found' } });
    }

    if (method === 'GET') {
      if (drive.folders.has(path)) return json(200, item(path, { folder: { childCount: 0 } }));
      if (drive.files.has(path)) return json(200, item(path, { file: {} }));
      return json(404, { error: { message: 'not found' } });
    }

    if (method === 'POST' && verb === 'children') {
      const body = JSON.parse(options.body);
      const target = path ? `${path}/${body.name}` : body.name;
      if (drive.folders.has(target) || drive.files.has(target)) return json(409, { error: { message: 'name already exists' } });
      drive.folders.add(target);
      return json(201, item(target, { folder: { childCount: 0 } }));
    }

    if (method === 'PUT' && verb === 'content') {
      const existing = drive.files.get(path);
      const ifMatch = options.headers?.['if-match'];
      if (ifMatch && existing && existing.eTag !== ifMatch) return json(412, { error: { message: 'etag mismatch' } });
      const version = existing ? Number(existing.eTag.replace(/"/g, '')) + 1 : 1;
      drive.files.set(path, { content: options.body, eTag: `"${version}"` });
      return json(200, item(path, { file: {} }));
    }

    if (method === 'PATCH') {
      const body = JSON.parse(options.body);
      if (!drive.folders.has(path)) return json(404, { error: { message: 'not found' } });
      const parent = path.split('/').slice(0, -1).join('/');
      const target = parent ? `${parent}/${body.name}` : body.name;
      if (drive.folders.has(target)) return json(409, { error: { message: 'name already exists' } });
      for (const folder of [...drive.folders].filter((f) => f === path || f.startsWith(`${path}/`))) {
        drive.folders.delete(folder);
        drive.folders.add(folder.replace(path, target));
      }
      for (const [file, value] of [...drive.files].filter(([f]) => f.startsWith(`${path}/`))) {
        drive.files.delete(file);
        drive.files.set(file.replace(path, target), value);
      }
      return json(200, item(target, { folder: {} }));
    }

    if (method === 'DELETE') {
      drive.folders.delete(path);
      drive.files.delete(path);
      return json(204, '');
    }

    return json(400, { error: { message: `unhandled ${method} ${path}` } });
  }

  return {
    drive,
    fetch: fetchImpl,
    getToken: async () => 'test-token',
    /** Queues one failed response for the next matching request. */
    failNext(match, status, body, headers) { drive.failures.push({ match, status, body, headers }); },
    read: (path) => drive.files.get(path)?.content ?? null,
    has: (path) => drive.folders.has(path) || drive.files.has(path),
    folderList: () => [...drive.folders].sort(),
  };
}

/** Minimal localStorage stand-in. */
export function createMemoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    get size() { return map.size; },
  };
}
