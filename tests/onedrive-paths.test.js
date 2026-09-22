import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachmentFilePath, baseFolderPaths, exceedsPathLimit, exportFilePath, formatProjectNumber,
  nextProjectNumber, parseProjectFolderName, parseProjectNumber, projectFolderName, projectPaths,
  sanitizeSegment, timestampedFileName,
} from '../src/core/storage/onedrive-paths.js';

test('a project folder is named by sequential number and project name', () => {
  assert.equal(projectFolderName(123, 'Smith Backyard Deck'), 'CME-000123 — Smith Backyard Deck');
  assert.equal(formatProjectNumber(1), 'CME-000001');
  assert.throws(() => formatProjectNumber(0), /positive integer/);
  assert.throws(() => formatProjectNumber(1.5), /positive integer/);
});

test('the project folder layout matches the DCR OneDrive structure', () => {
  const paths = projectPaths(123, 'Smith Backyard Deck');
  const folder = 'CME/Projects/CME-000123 — Smith Backyard Deck';
  assert.equal(paths.folder, folder);
  assert.equal(paths.projectFile, `${folder}/project.cme.json`);
  assert.deepEqual(paths.subfolders, [
    `${folder}/Exports`, `${folder}/Exports/Plans`, `${folder}/Exports/Takeoffs`, `${folder}/Exports/DCR Sales Hub`,
    `${folder}/Attachments`, `${folder}/Attachments/Photos`, `${folder}/Attachments/Audio`,
  ]);
  assert.equal(paths.exports.plan, `${folder}/Exports/Plans`);
  assert.equal(paths.exports['sales-hub'], `${folder}/Exports/DCR Sales Hub`);
  assert.equal(paths.attachments.photo, `${folder}/Attachments/Photos`);
  assert.equal(paths.attachments.audio, `${folder}/Attachments/Audio`);
});

test('templates live beside projects under the CME root', () => {
  assert.deepEqual(baseFolderPaths(), ['CME', 'CME/Projects', 'CME/Templates', 'CME/Templates/Materials', 'CME/Templates/Assemblies']);
});

test('project numbers continue past the highest existing folder and ignore unrelated folders', () => {
  assert.equal(nextProjectNumber([]), 1);
  assert.equal(nextProjectNumber(['CME-000001 — A', 'CME-000123 — B', 'Archive', 'Old CME-999999']), 124);
  assert.equal(parseProjectNumber('Archive'), null);
  assert.equal(parseProjectNumber('CME-000007 — Deck'), 7);
});

test('a project folder name round-trips back to its number and name', () => {
  assert.deepEqual(parseProjectFolderName(projectFolderName(42, 'Smith Backyard Deck')), { number: 42, name: 'Smith Backyard Deck' });
  assert.equal(parseProjectFolderName('Not a project'), null);
});

test('names illegal in OneDrive are made safe without collapsing to nothing', () => {
  assert.equal(sanitizeSegment('Bad/Name:  *?<>|  .'), 'Bad-Name');
  assert.equal(sanitizeSegment('   '), 'Untitled');
  assert.equal(sanitizeSegment('CON'), 'CON-cme'); // reserved device name
  assert.equal(sanitizeSegment('~$lockfile'), 'lockfile');
  assert.equal(sanitizeSegment('_vti_config'), '_vti_config-cme');
  assert.equal(sanitizeSegment('trailing dot.'), 'trailing dot');
  assert.equal(projectFolderName(9, '///'), 'CME-000009 — Untitled deck');
});

test('an over-long project name is truncated instead of breaking the path', () => {
  const name = projectFolderName(9, 'x'.repeat(300));
  assert.ok(name.length < 110, `expected a truncated folder name, got ${name.length} characters`);
  assert.ok(!exceedsPathLimit(`CME/Projects/${name}/project.cme.json`));
  assert.ok(exceedsPathLimit(`CME/${'y'.repeat(400)}`));
});

test('export and attachment destinations resolve by kind and reject unknown kinds', () => {
  const folder = 'CME/Projects/CME-000123 — Smith Backyard Deck';
  assert.equal(exportFilePath(123, 'Smith Backyard Deck', 'takeoff', 'takeoff.json'), `${folder}/Exports/Takeoffs/takeoff.json`);
  assert.equal(attachmentFilePath(123, 'Smith Backyard Deck', 'photo', 'front.jpg'), `${folder}/Attachments/Photos/front.jpg`);
  assert.throws(() => exportFilePath(1, 'x', 'invoices', 'a.pdf'), /Unsupported CME export destination/);
  assert.throws(() => attachmentFilePath(1, 'x', 'video', 'a.mp4'), /Unsupported CME attachment destination/);
});

test('export file names are timestamped so exports never overwrite each other', () => {
  assert.equal(timestampedFileName('plan', 'pdf', '2026-09-22T14:31:07.000Z'), '2026-09-22-1431-plan.pdf');
});
