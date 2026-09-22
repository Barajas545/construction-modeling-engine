import test from 'node:test';
import assert from 'node:assert/strict';
import { OneDriveError, createOneDriveClient, driveItemUrl, encodeDrivePath } from '../src/core/storage/onedrive-client.js';
import { createFakeDrive } from './helpers/fake-onedrive.js';

const client = (fake) => createOneDriveClient({ getToken: fake.getToken, fetch: fake.fetch, sleep: async () => {} });

test('drive paths are URL-encoded per segment while keeping separators', () => {
  assert.equal(encodeDrivePath('CME/Projects/CME-000123 — Smith Deck'), 'CME/Projects/CME-000123%20%E2%80%94%20Smith%20Deck');
  assert.equal(driveItemUrl('CME/Projects', 'children'), 'https://graph.microsoft.com/v1.0/me/drive/root:/CME/Projects:/children');
  assert.equal(driveItemUrl(''), 'https://graph.microsoft.com/v1.0/me/drive/root');
});

test('ensureFolderPath creates only the missing folders in a path', async () => {
  const fake = createFakeDrive({ folders: ['CME'] });
  await client(fake).ensureFolderPath('CME/Projects/CME-000001 — Deck/Exports/Plans');
  assert.deepEqual(fake.folderList(), [
    'CME', 'CME/Projects', 'CME/Projects/CME-000001 — Deck',
    'CME/Projects/CME-000001 — Deck/Exports', 'CME/Projects/CME-000001 — Deck/Exports/Plans',
  ]);
  const creations = fake.drive.requests.filter((r) => r.method === 'POST').length;
  assert.equal(creations, 4, 'the existing CME folder should not be recreated');
});

test('a folder created concurrently by another device is adopted, not treated as an error', async () => {
  const fake = createFakeDrive({ folders: ['CME'] });
  // The existence probe misses, then another device wins the race before our
  // create lands, so Graph answers 409 for a folder that now genuinely exists.
  fake.failNext((method, path, verb) => {
    if (method !== 'POST' || verb !== 'children') return false;
    fake.drive.folders.add('CME/Projects');
    return true;
  }, 409, { error: { message: 'already exists' } });

  const item = await client(fake).ensureFolderPath('CME/Projects');
  assert.ok(item?.folder, 'the folder created by the other device should be adopted');
  assert.equal(item.name, 'Projects');
  assert.ok(fake.has('CME/Projects'));
});

test('a file occupying a folder path is reported rather than silently overwritten', async () => {
  const fake = createFakeDrive({ folders: ['CME'], files: { 'CME/Projects': 'not a folder' } });
  await assert.rejects(() => client(fake).ensureFolderPath('CME/Projects/Deck'), (error) => {
    assert.ok(error instanceof OneDriveError);
    assert.equal(error.kind, 'conflict');
    return true;
  });
});

test('putFile writes content and a conditional write fails on a stale eTag', async () => {
  const fake = createFakeDrive({ folders: ['CME'] });
  const api = client(fake);
  const first = await api.putFile('CME/note.json', '{"a":1}', { contentType: 'application/json' });
  assert.equal(fake.read('CME/note.json'), '{"a":1}');

  await api.putFile('CME/note.json', '{"a":2}', { contentType: 'application/json' });
  await assert.rejects(
    () => api.putFile('CME/note.json', '{"a":3}', { contentType: 'application/json', eTag: first.eTag }),
    (error) => error instanceof OneDriveError && error.kind === 'precondition',
  );
  assert.equal(fake.read('CME/note.json'), '{"a":2}', 'the stale write must not land');
});

test('reads return null for a missing file instead of throwing', async () => {
  const fake = createFakeDrive({ folders: ['CME'] });
  assert.equal(await client(fake).readFile('CME/missing.json'), null);
  assert.equal(await client(fake).getItem('CME/missing.json'), null);
});

test('readJsonWithETag returns the parsed document alongside its version', async () => {
  const fake = createFakeDrive({ folders: ['CME'], files: { 'CME/p.json': '{"name":"Deck"}' } });
  const result = await client(fake).readJsonWithETag('CME/p.json');
  assert.equal(result.value.name, 'Deck');
  assert.equal(result.eTag, '"1"');
});

test('throttling is retried with backoff and then succeeds', async () => {
  const fake = createFakeDrive({ folders: ['CME'] });
  fake.failNext((method, path) => method === 'PUT' && path === 'CME/a.json', 429, { error: { message: 'slow down' } }, { 'retry-after': '0' });
  await client(fake).putFile('CME/a.json', '{}', { contentType: 'application/json' });
  assert.equal(fake.read('CME/a.json'), '{}');
});

test('a network failure surfaces as an offline error after retries', async () => {
  const failing = createOneDriveClient({
    getToken: async () => 't',
    fetch: async () => { throw new TypeError('Failed to fetch'); },
    sleep: async () => {},
  });
  await assert.rejects(() => failing.getItem('CME'), (error) => {
    assert.ok(error instanceof OneDriveError);
    assert.equal(error.kind, 'offline');
    assert.match(error.message, /stayed saved on this device/);
    return true;
  });
});

test('an expired sign-in is reported as an auth error without retrying', async () => {
  const fake = createFakeDrive({ folders: ['CME'] });
  fake.failNext((method) => method === 'GET', 401, { error: { message: 'token expired' } });
  await assert.rejects(() => client(fake).listChildren('CME'), (error) => error instanceof OneDriveError && error.kind === 'auth');
});

test('listChildren follows Graph paging to the end', async () => {
  let page = 0;
  const paging = createOneDriveClient({
    getToken: async () => 't',
    sleep: async () => {},
    fetch: async () => ({
      ok: true, status: 200, headers: { get: () => null },
      json: async () => (page++ === 0
        ? { value: [{ name: 'a', folder: {} }], '@odata.nextLink': 'https://graph.microsoft.com/next' }
        : { value: [{ name: 'b', folder: {} }] }),
    }),
  });
  assert.deepEqual((await paging.listChildren('CME')).map((c) => c.name), ['a', 'b']);
});

test('renaming a folder moves its children with it', async () => {
  const fake = createFakeDrive({ folders: ['CME', 'CME/Old', 'CME/Old/Exports'], files: { 'CME/Old/project.cme.json': '{}' } });
  await client(fake).renameItem('CME/Old', 'New');
  assert.ok(fake.has('CME/New/Exports'));
  assert.equal(fake.read('CME/New/project.cme.json'), '{}');
  assert.ok(!fake.has('CME/Old'));
});
