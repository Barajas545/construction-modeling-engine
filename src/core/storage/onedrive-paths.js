// Derives the CME OneDrive folder structure. Pure and serializable: no network,
// no browser APIs, so the layout is a testable contract rather than call-site strings.

export const CME_ROOT = 'CME';
export const PROJECTS_FOLDER = 'Projects';
export const TEMPLATES_FOLDER = 'Templates';
export const PROJECT_FILE = 'project.cme.json';
export const PROJECT_NUMBER_PREFIX = 'CME-';
export const PROJECT_NUMBER_DIGITS = 6;
export const PROJECT_NAME_SEPARATOR = ' — '; // space em-dash space, per the DCR layout
export const MAX_PROJECT_NAME_SEGMENT = 80; // matches the project-name input maxlength
export const MAX_PATH_LENGTH = 400; // OneDrive full-path ceiling

// Folders created inside every project folder.
export const PROJECT_SUBFOLDERS = Object.freeze([
  'Exports', 'Exports/Plans', 'Exports/Takeoffs', 'Exports/DCR Sales Hub',
  'Attachments', 'Attachments/Photos', 'Attachments/Audio',
]);
export const TEMPLATE_SUBFOLDERS = Object.freeze(['Materials', 'Assemblies']);

// Named destinations so callers never hand-build a relative path.
export const EXPORT_KINDS = Object.freeze({
  plan: 'Exports/Plans',
  takeoff: 'Exports/Takeoffs',
  'sales-hub': 'Exports/DCR Sales Hub',
});
export const ATTACHMENT_KINDS = Object.freeze({
  photo: 'Attachments/Photos',
  audio: 'Attachments/Audio',
});

const ILLEGAL_CHARACTERS = /["*:<>?/\\|]/g;
const CONTROL_CHARACTERS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g');
// OneDrive and SharePoint reject these outright, case-insensitively.
const RESERVED_NAMES = new Set([
  '.lock', 'con', 'prn', 'aux', 'nul', 'desktop.ini',
  ...Array.from({ length: 10 }, (_, index) => `com${index}`),
  ...Array.from({ length: 10 }, (_, index) => `lpt${index}`),
]);

/**
 * Makes one path segment safe for OneDrive. Returns `fallback` when nothing
 * usable survives, so a folder is never created with an empty or rejected name.
 */
export function sanitizeSegment(value, fallback = 'Untitled') {
  let segment = String(value ?? '')
    .replace(CONTROL_CHARACTERS, '')
    .replace(ILLEGAL_CHARACTERS, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-') // an illegal-character run collapses to one dash
    .replace(/^[-.\s]+|[-.\s]+$/g, '') // OneDrive rejects leading/trailing dots and spaces
    .replace(/^~\$+/, ''); // leading ~$ marks Office lock files
  if (segment.startsWith('_vti_') || RESERVED_NAMES.has(segment.toLowerCase())) segment = `${segment}-cme`;
  return segment === '' ? fallback : segment;
}

/** 123 -> "CME-000123". Non-positive or non-finite numbers are rejected. */
export function formatProjectNumber(number) {
  const value = Number(number);
  if (!Number.isInteger(value) || value < 1) throw new Error('A CME project number must be a positive integer.');
  return `${PROJECT_NUMBER_PREFIX}${String(value).padStart(PROJECT_NUMBER_DIGITS, '0')}`;
}

/** "CME-000123 - Smith Backyard Deck" -> 123. Returns null for unrelated folders. */
export function parseProjectNumber(folderName) {
  const match = /^CME-(\d{1,9})(?:\s|$)/.exec(String(folderName ?? '').trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Next free project number given the folder names already in CME/Projects.
 * Gaps are never reused: numbers stay stable once a folder exists.
 */
export function nextProjectNumber(existingFolderNames = []) {
  const highest = existingFolderNames.reduce((max, name) => Math.max(max, parseProjectNumber(name) ?? 0), 0);
  return highest + 1;
}

/** "CME-000123 - Smith Backyard Deck" */
export function projectFolderName(projectNumber, projectName) {
  const label = sanitizeSegment(projectName, 'Untitled deck').slice(0, MAX_PROJECT_NAME_SEGMENT).trim();
  return `${formatProjectNumber(projectNumber)}${PROJECT_NAME_SEPARATOR}${sanitizeSegment(label, 'Untitled deck')}`;
}

/** Splits a project folder name back into its number and display name. */
export function parseProjectFolderName(folderName) {
  const number = parseProjectNumber(folderName);
  if (number === null) return null;
  const rest = String(folderName).trim().slice(formatProjectNumber(number).length);
  return { number, name: rest.startsWith(PROJECT_NAME_SEPARATOR) ? rest.slice(PROJECT_NAME_SEPARATOR.length) : rest.trim() };
}

const join = (...segments) => segments.filter((segment) => segment !== '' && segment != null).join('/');

export function projectsRootPath() { return join(CME_ROOT, PROJECTS_FOLDER); }
export function templatesRootPath() { return join(CME_ROOT, TEMPLATES_FOLDER); }

/** Every path for one project, resolved once so callers stay declarative. */
export function projectPaths(projectNumber, projectName) {
  return projectPathsFromFolderName(projectFolderName(projectNumber, projectName));
}

/**
 * Paths for a project folder that already exists under its current name.
 * Used while a project is being renamed, when the stored folder name and the
 * name derived from the document still disagree.
 */
export function projectPathsFromFolderName(folderName) {
  const folder = join(projectsRootPath(), folderName);
  return {
    folderName,
    folder,
    projectFile: join(folder, PROJECT_FILE),
    exports: Object.fromEntries(Object.entries(EXPORT_KINDS).map(([kind, relative]) => [kind, join(folder, relative)])),
    attachments: Object.fromEntries(Object.entries(ATTACHMENT_KINDS).map(([kind, relative]) => [kind, join(folder, relative)])),
    subfolders: PROJECT_SUBFOLDERS.map((relative) => join(folder, relative)),
  };
}

/** Destination path for one export file. Throws on an unknown export kind. */
export function exportFilePath(projectNumber, projectName, kind, fileName) {
  const relative = EXPORT_KINDS[kind];
  if (!relative) throw new Error(`Unsupported CME export destination: ${kind}`);
  return join(projectPaths(projectNumber, projectName).folder, relative, sanitizeSegment(fileName, 'export'));
}

/** Destination path for one attachment. Throws on an unknown attachment kind. */
export function attachmentFilePath(projectNumber, projectName, kind, fileName) {
  const relative = ATTACHMENT_KINDS[kind];
  if (!relative) throw new Error(`Unsupported CME attachment destination: ${kind}`);
  return join(projectPaths(projectNumber, projectName).folder, relative, sanitizeSegment(fileName, 'attachment'));
}

/** Folders that must exist before any project is written. */
export function baseFolderPaths() {
  return [CME_ROOT, projectsRootPath(), templatesRootPath(), ...TEMPLATE_SUBFOLDERS.map((name) => join(templatesRootPath(), name))];
}

/** Timestamped, collision-resistant export file name: "2026-09-22-1431-plan.pdf". */
export function timestampedFileName(prefix, extension, now = new Date().toISOString()) {
  const compact = String(now).replace(/[:-]/g, '');
  const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}-${compact.slice(9, 13)}`;
  return sanitizeSegment(`${date}-${prefix}.${extension}`, `${date}-export.${extension}`);
}

/** True when a path would exceed what OneDrive can store. */
export function exceedsPathLimit(path) {
  return String(path ?? '').length > MAX_PATH_LENGTH;
}
