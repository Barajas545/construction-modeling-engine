import { SYNC_STATUS } from '../../core/storage/onedrive-service.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const clock = (iso) => {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
};

/** Short label and dot colour for the OneDrive status line. */
export function describeSyncStatus(state, location = null) {
  const folder = location?.folder ? location.folder.replace(/^CME\/Projects\//, '') : null;
  switch (state.status) {
    case SYNC_STATUS.unconfigured:
      return { tone: 'muted', label: 'OneDrive not set up', help: 'Add the Entra application ID to connect this tenant.' };
    case SYNC_STATUS.disconnected:
      return { tone: 'muted', label: 'OneDrive disconnected', help: state.detail || 'Projects are saved on this device only.' };
    case SYNC_STATUS.connecting:
      return { tone: 'busy', label: 'Connecting to OneDrive…', help: '' };
    case SYNC_STATUS.saving:
      return { tone: 'busy', label: 'Saving to OneDrive…', help: folder ? esc(folder) : '' };
    case SYNC_STATUS.saved:
      return { tone: 'good', label: `Saved to OneDrive ${clock(state.lastSavedAt)}`.trim(), help: folder ? esc(folder) : '' };
    case SYNC_STATUS.offline:
      return { tone: 'warn', label: 'Offline · saved on this device', help: 'CME will sync when the connection returns.' };
    case SYNC_STATUS.conflict:
      return { tone: 'warn', label: 'This project changed in OneDrive', help: 'Choose which copy to keep.' };
    case SYNC_STATUS.error:
      return { tone: 'warn', label: 'OneDrive save failed', help: state.detail };
    default:
      return { tone: 'good', label: state.accountName ? `OneDrive · ${esc(state.accountName)}` : 'OneDrive connected', help: folder ? esc(folder) : '' };
  }
}

/** The OneDrive block inside the project options menu. */
export function renderOneDrivePanel(state, location = null) {
  const status = describeSyncStatus(state, location);
  const number = location?.number ? `<code class="onedrive-number">${esc(location.number)}</code>` : '';
  const actions = !state.configured
    ? '<p class="onedrive-setup">Add the Entra application (client) ID to <code>src/core/storage/onedrive-config.js</code>. Setup steps are in <code>docs/integrations/OneDrive-Setup.md</code>.</p>'
    : state.connected
      ? `<div class="onedrive-actions"><button class="button" data-action="onedrive-save-now">Save now</button><button class="button" data-action="onedrive-open">Open from OneDrive</button><button class="button ghost" data-action="onedrive-disconnect">Sign out</button></div>`
      : '<div class="onedrive-actions"><button class="button primary" data-action="onedrive-connect">Connect OneDrive</button></div>';

  const conflictBlock = state.status === SYNC_STATUS.conflict
    ? `<div class="onedrive-conflict"><strong>Another device saved this project.</strong><p>OneDrive has a newer copy of ${esc(state.conflict?.remote?.name ?? 'this project')}. Keeping this device's copy replaces it.</p><div class="onedrive-actions"><button class="button primary" data-action="onedrive-keep-local">Keep this device's copy</button><button class="button" data-action="onedrive-take-remote">Use the OneDrive copy</button></div></div>`
    : '';

  return `<div class="onedrive-panel"><div class="onedrive-heading"><span class="onedrive-dot ${status.tone}"></span><div><strong>${status.label}</strong>${status.help ? `<small>${status.help}</small>` : ''}</div>${number}</div>${conflictBlock}${actions}</div>`;
}

/** The "open a project from OneDrive" list. */
export function renderOneDriveProjectList(projects, loading) {
  if (loading) return '<div class="onedrive-remote-list"><p>Reading CME/Projects…</p></div>';
  if (!projects.length) return '<div class="onedrive-remote-list"><p>No CME projects in OneDrive yet.</p></div>';
  const rows = projects.map((project) => `<button class="onedrive-remote-row" data-action="onedrive-open-project" data-folder="${esc(project.folderName)}"><code>CME-${String(project.number).padStart(6, '0')}</code><span>${esc(project.name)}</span></button>`).join('');
  return `<div class="onedrive-remote-list"><div class="project-list-heading"><span>Projects in OneDrive</span><small>${projects.length}</small></div>${rows}</div>`;
}
