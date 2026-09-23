import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectDocument, upsertObject } from '../src/core/document/project-document.js';
import { createDeckBoundary } from '../src/tools/deck-boundary/deck-boundary.js';
import { SYNC_STATUS, createOneDriveService } from '../src/core/storage/onedrive-service.js';
import { describeSyncStatus, renderOneDrivePanel } from '../src/tools/onedrive/onedrive-controls.js';
import { createFakeDrive, createMemoryStorage } from './helpers/fake-onedrive.js';

const now = '2026-09-22T12:00:00.000Z';
const FOLDER = 'CME/Projects/CME-000001 — Smith Backyard Deck';
const config = { clientId: 'test-client-id', tenantId: 'dcrserver.onmicrosoft.com', scopes: ['Files.ReadWrite'], msalUrl: '' };

function project(name = 'Smith Backyard Deck', id = 'project-1') {
  const document = createProjectDocument({ id, name, now });
  return upsertObject(document, createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]), now);
}

/** A stand-in for MSAL that signs in without a network or a popup. */
function fakeAuth(account = { name: 'Cristobal', username: 'cristobal@dcrserver.onmicrosoft.com' }) {
  let signedIn = false;
  return {
    isSignedIn: async () => signedIn,
    account: () => (signedIn ? account : null),
    signIn: async () => { signedIn = true; return account; },
    signOut: async () => { signedIn = false; },
    getToken: async () => 'test-token',
    configured: () => true,
  };
}

function harness(options = {}) {
  const fake = createFakeDrive({ folders: [], ...options });
  const timers = [];
  const service = createOneDriveService({
    config, auth: fakeAuth(), storage: createMemoryStorage(), now: () => now,
    fetch: fake.fetch, sleep: async () => {},
    setTimeoutImpl: (fn) => { timers.push(fn); return timers.length; },
    clearTimeoutImpl: (id) => { timers[id - 1] = null; },
  });
  return { fake, service, runTimers: () => timers.splice(0).forEach((fn) => fn?.()) };
}

test('an unconfigured install explains itself instead of failing at sign-in', async () => {
  const service = createOneDriveService({ config: { ...config, clientId: '' }, auth: fakeAuth(), storage: createMemoryStorage() });
  assert.equal(service.state().status, SYNC_STATUS.unconfigured);
  assert.equal((await service.connect()).status, SYNC_STATUS.unconfigured);
  assert.match(renderOneDrivePanel(service.state()), /Entra application \(client\) ID/);
});

test('connecting provisions the CME tree and reports the signed-in account', async () => {
  const { fake, service } = harness();
  const state = await service.connect();
  assert.equal(state.status, SYNC_STATUS.idle);
  assert.equal(state.accountName, 'Cristobal');
  assert.ok(fake.has('CME/Projects'));
  assert.ok(fake.has('CME/Templates/Materials'));
  const panel = renderOneDrivePanel(state);
  assert.match(panel, /onedrive-save-now/);
  assert.match(panel, /onedrive-disconnect/);
});

test('autosave is debounced: many edits produce one upload', async () => {
  const { fake, service, runTimers } = harness();
  await service.connect();
  for (let edit = 0; edit < 5; edit += 1) service.scheduleSave(upsertObject(project(), { id: `marker-${edit}`, type: 'note' }, now));
  runTimers();
  await new Promise((resolve) => setImmediate(resolve));
  const writes = fake.drive.requests.filter((r) => r.method === 'PUT' && r.verb === 'content');
  assert.equal(writes.length, 1, 'only the last edit should be uploaded');
  const written = JSON.parse(fake.read(`${FOLDER}/project.cme.json`));
  assert.ok(written.objects.some((object) => object.id === 'marker-4'), 'the newest edit should be the one that landed');
});

test('nothing is uploaded while signed out', async () => {
  const { fake, service, runTimers } = harness();
  service.scheduleSave(project());
  runTimers();
  assert.equal(fake.drive.requests.length, 0);
  assert.equal(await service.saveNow(project()), null);
});

test('an empty new project claims no OneDrive folder or project number', async () => {
  const { fake, service, runTimers } = harness();
  await service.connect();
  const empty = createProjectDocument({ id: 'empty-1', name: 'Deck project 2', now });

  service.scheduleSave(empty);
  runTimers();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await service.saveNow(empty)).status, 'empty');

  const folders = fake.folderList().filter((f) => /CME-\d{6}/.test(f));
  assert.deepEqual(folders, [], 'an abandoned new project should not reserve a number');
  assert.equal(service.describeLocation(empty), null);
});

test('a project syncs as soon as it holds a construction object', async () => {
  const { fake, service } = harness();
  await service.connect();
  const empty = createProjectDocument({ id: 'grows-1', name: 'Smith Backyard Deck', now });
  assert.equal((await service.saveNow(empty)).status, 'empty');

  const drawn = upsertObject(empty, createDeckBoundary([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]), now);
  assert.equal((await service.saveNow(drawn)).status, 'saved');
  assert.ok(fake.read(`${FOLDER}/project.cme.json`));
});

test('a stored project keeps syncing after its last object is deleted', async () => {
  const { fake, service } = harness();
  await service.connect();
  const saved = (await service.saveNow(project())).document;

  // Deleting the last object must still reach OneDrive, not strand a stale copy.
  const emptied = { ...saved, objects: [] };
  assert.equal((await service.saveNow(emptied)).status, 'saved');
  assert.equal(JSON.parse(fake.read(`${FOLDER}/project.cme.json`)).objects.length, 0);
});

test('a save hands back the numbered document so the device copy can match it', async () => {
  const fake = createFakeDrive({ folders: [] });
  const saved = [];
  const service = createOneDriveService({
    config, auth: fakeAuth(), storage: createMemoryStorage(), now: () => now,
    fetch: fake.fetch, sleep: async () => {}, onSaved: (document) => saved.push(document),
  });
  await service.connect();

  // An autosave, not just the explicit button, must report the assigned number.
  await service.saveNow(project());
  assert.equal(saved.length, 1);
  assert.equal(saved[0].projectNumber, 1);
  assert.equal(saved[0].id, 'project-1');
});

test('a save reports where the project landed', async () => {
  const { service } = harness();
  await service.connect();
  const result = await service.saveNow(project());
  assert.equal(result.status, 'saved');
  assert.equal(service.state().status, SYNC_STATUS.saved);
  assert.equal(describeSyncStatus(service.state(), service.describeLocation(result.document)).tone, 'good');
  assert.equal(service.describeLocation(result.document).number, 'CME-000001');
});

test('a conflict is surfaced for the estimator and can be resolved either way', async () => {
  const { fake, service } = harness();
  await service.connect();
  const saved = await service.saveNow(project());
  fake.drive.files.set(`${FOLDER}/project.cme.json`, { content: JSON.stringify({ ...saved.document, name: 'Edited elsewhere' }), eTag: '"99"' });

  await service.saveNow({ ...saved.document, name: 'Local edit' });
  assert.equal(service.state().status, SYNC_STATUS.conflict);
  assert.match(renderOneDrivePanel(service.state()), /Another device saved this project/);
  assert.equal(JSON.parse(fake.read(`${FOLDER}/project.cme.json`)).name, 'Edited elsewhere', 'the refused save must change nothing');

  await service.keepLocal();
  assert.equal(service.state().status, SYNC_STATUS.saved);
  // Keeping the local copy also renames the folder to match the local name.
  const renamed = 'CME/Projects/CME-000001 — Local edit';
  assert.equal(JSON.parse(fake.read(`${renamed}/project.cme.json`)).name, 'Local edit');
  assert.ok(!fake.has(FOLDER));
});

test('taking the OneDrive copy hands the remote document back and clears the conflict', async () => {
  const { fake, service } = harness();
  await service.connect();
  const saved = await service.saveNow(project());
  fake.drive.files.set(`${FOLDER}/project.cme.json`, { content: JSON.stringify({ ...saved.document, name: 'Edited elsewhere' }), eTag: '"99"' });
  await service.saveNow({ ...saved.document, name: 'Local edit' });

  const remote = service.takeRemote();
  assert.equal(remote.name, 'Edited elsewhere');
  assert.equal(service.state().status, SYNC_STATUS.idle);
  assert.equal(service.takeRemote(), null);
});

test('going offline is reported as a device-only save, not as data loss', async () => {
  const fake = createFakeDrive({ folders: [] });
  let online = true;
  const service = createOneDriveService({
    config, auth: fakeAuth(), storage: createMemoryStorage(), now: () => now, sleep: async () => {},
    fetch: async (...args) => { if (!online) throw new TypeError('Failed to fetch'); return fake.fetch(...args); },
  });
  await service.connect();
  online = false;
  await service.saveNow(project());
  assert.equal(service.state().status, SYNC_STATUS.offline);
  const described = describeSyncStatus(service.state());
  assert.equal(described.tone, 'warn');
  assert.match(described.label, /saved on this device/);
});

test('an expired session returns to the disconnected state so the estimator can sign in again', async () => {
  const { fake, service } = harness();
  await service.connect();
  fake.failNext(() => true, 401, { error: { message: 'token expired' } });
  await service.saveNow(project());
  assert.equal(service.state().status, SYNC_STATUS.disconnected);
  assert.equal(service.state().connected, false);
});

test('flush uploads a pending autosave that has not fired yet', async () => {
  const { fake, service } = harness();
  await service.connect();
  service.scheduleSave(project());
  assert.equal(fake.read(`${FOLDER}/project.cme.json`), null);
  await service.flush();
  assert.ok(fake.read(`${FOLDER}/project.cme.json`), 'the pending edit should reach OneDrive');
});

test('exports and attachments are filed only while connected', async () => {
  const { fake, service } = harness();
  assert.equal(await service.saveExport(project(), 'takeoff', { content: '{}' }), null);
  await service.connect();
  const document = (await service.saveNow(project())).document;
  const takeoff = await service.saveExport(document, 'takeoff', { content: '{}', extension: 'json', prefix: 'takeoff' });
  const photo = await service.saveAttachment(document, 'photo', { content: 'JPEG', extension: 'jpg', prefix: 'site' });
  assert.equal(takeoff.path, `${FOLDER}/Exports/Takeoffs/2026-09-22-1200-takeoff.json`);
  assert.equal(photo.path, `${FOLDER}/Attachments/Photos/2026-09-22-1200-site.jpg`);
  assert.equal(fake.read(takeoff.path), '{}');
});

test('signing out stops autosave and leaves the device copy alone', async () => {
  const { fake, service, runTimers } = harness();
  await service.connect();
  service.scheduleSave(project());
  await service.disconnect();
  runTimers();
  assert.equal(service.state().status, SYNC_STATUS.disconnected);
  assert.equal(fake.read(`${FOLDER}/project.cme.json`), null);
});

test('an edit made while the session is still resuming still reaches OneDrive', async () => {
  const auth = fakeAuth();
  await auth.signIn();
  const fake = createFakeDrive({ folders: [] });
  const service = createOneDriveService({ config, auth, storage: createMemoryStorage(), now: () => now, fetch: fake.fetch, sleep: async () => {} });

  // The estimator draws before resume() has finished restoring the session.
  service.scheduleSave(project());
  assert.equal(fake.read(`${FOLDER}/project.cme.json`), null);

  await service.resume();
  assert.ok(fake.read(`${FOLDER}/project.cme.json`), 'the buffered edit should sync once the session resumes');
});

test('an edit made before signing in syncs as soon as the connection is made', async () => {
  const { fake, service } = harness();
  service.scheduleSave(project());
  assert.equal(fake.read(`${FOLDER}/project.cme.json`), null);
  await service.connect();
  assert.ok(fake.read(`${FOLDER}/project.cme.json`), 'connecting should flush the buffered edit');
});

test('resume restores an existing session without prompting', async () => {
  const auth = fakeAuth();
  await auth.signIn();
  const fake = createFakeDrive({ folders: [] });
  const service = createOneDriveService({ config, auth, storage: createMemoryStorage(), now: () => now, fetch: fake.fetch, sleep: async () => {} });
  const state = await service.resume();
  assert.equal(state.status, SYNC_STATUS.idle);
  assert.equal(state.connected, true);
});
