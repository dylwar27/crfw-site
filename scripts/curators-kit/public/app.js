// Curator's Kit — frontend SPA (vanilla, no build step).
// Communicates with the local server via /api/*. Every save
// commits to git; the curator pushes when ready.

const API = '/api';
const state = {
  collection: null,
  entries: [],
  selectedSlug: null,
  current: null,     // full entry with editableFields
  dirty: false,
  search: '',
};

// ---------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------
const $ = id => document.getElementById(id);
const sidebar = $('collections');
const listTitle = $('list-title');
const listEl = $('entry-list');
const searchInput = $('search');
const editorEmpty = document.querySelector('.editor-empty');
const editorBody = $('editor-body');

// ---------------------------------------------------------------
// Load + render collection list
// ---------------------------------------------------------------
async function loadCollections() {
  const cols = await fetch(`${API}/collections`).then(r => r.json());
  sidebar.innerHTML = '';
  for (const c of cols) {
    const btn = document.createElement('button');
    btn.dataset.collection = c.name;
    btn.textContent = c.name.replace(/_/g, ' ');
    btn.addEventListener('click', () => selectCollection(c.name));
    sidebar.appendChild(btn);
  }
}

async function selectCollection(name) {
  if (state.dirty && !confirm('Discard unsaved changes?')) return;
  state.collection = name;
  state.selectedSlug = null;
  state.dirty = false;
  state.current = null;
  listTitle.textContent = name.replace(/_/g, ' ');
  document.querySelectorAll('#collections button').forEach(b =>
    b.classList.toggle('active', b.dataset.collection === name));
  renderEmpty();
  state.entries = await fetch(`${API}/entries/${name}`).then(r => r.json());
  // Sort newest first
  state.entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  renderList();
  updateSidebarCounts();
}

function renderList() {
  const q = state.search.toLowerCase().trim();
  const filtered = q
    ? state.entries.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.project || '').toLowerCase().includes(q) ||
        (e.slug || '').toLowerCase().includes(q))
    : state.entries;
  listEl.innerHTML = '';
  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="padding: 20px; color: var(--ink-dim); font-family: var(--mono); font-size: 12px;">No entries match</div>`;
    return;
  }
  for (const e of filtered) {
    const item = document.createElement('button');
    item.className = 'entry-item' + (e.published ? '' : ' unpublished');
    item.dataset.slug = e.slug;
    if (state.selectedSlug === e.slug) item.classList.add('active');
    item.innerHTML = `
      <div class="entry-title">${escapeHtml(e.title || e.slug)}</div>
      <div class="entry-meta">
        <span>${escapeHtml(e.date || '')}</span>
        <span>${escapeHtml(e.project || '')}</span>
        ${e.format ? `<span>${escapeHtml(e.format)}</span>` : ''}
      </div>`;
    item.addEventListener('click', () => selectEntry(e.slug));
    listEl.appendChild(item);
  }
}

function updateSidebarCounts() {
  // Show count of entries per collection (poll all in parallel; cheap)
  // Skipped for v1 simplicity — just show the selected collection's count.
  // TODO v2: add per-collection counts.
}

// ---------------------------------------------------------------
// Select + render entry editor
// ---------------------------------------------------------------
async function selectEntry(slug) {
  if (state.dirty && !confirm('Discard unsaved changes?')) return;
  state.selectedSlug = slug;
  state.dirty = false;
  document.querySelectorAll('.entry-item').forEach(el =>
    el.classList.toggle('active', el.dataset.slug === slug));
  const entry = await fetch(`${API}/entries/${state.collection}/${slug}`).then(r => r.json());
  if (entry.error) { toast('Failed to load entry: ' + entry.error, true); return; }
  state.current = entry;
  renderEditor();
}

function renderEmpty() {
  editorEmpty.hidden = false;
  editorBody.hidden = true;
  editorBody.innerHTML = '';
}

function renderEditor() {
  const entry = state.current;
  editorEmpty.hidden = true;
  editorBody.hidden = false;

  const d = entry.data;
  const fields = entry.editableFields || [];

  const title = d.title || d.name || entry.slug;
  const parts = [];

  parts.push(`<h1 class="editor-title">${escapeHtml(title)}</h1>`);
  parts.push(`<div class="editor-subtitle">${escapeHtml(entry.collection)} / ${escapeHtml(entry.slug)} · ${escapeHtml(entry.path)}</div>`);

  for (const key of fields) {
    parts.push(renderField(key, d[key]));
  }

  // Actions
  parts.push(`
    <div class="actions">
      <button class="btn" id="btn-mark-unpublished" title="Hide from public timeline">
        ${d.published === false ? 'Mark Published' : 'Mark Unpublished'}
      </button>
      <div class="spacer"></div>
      <span class="status" id="save-status"></span>
      <button class="btn" id="btn-cancel">Cancel</button>
      <button class="btn btn-primary" id="btn-save">Save & Commit</button>
    </div>
  `);

  editorBody.innerHTML = parts.join('');
  wireEditor();
}

function renderField(key, value) {
  const isLong = ['summary', 'transcript', 'caption', 'note'].includes(key);
  const isBool = key === 'published';
  const isTags = key === 'tags';
  const isEnum = ['format', 'kind', 'source', 'bandcampItemType'].includes(key);
  const isDate = key === 'date';

  let widget;
  if (isBool) {
    widget = `
      <div class="field-toggle">
        <input type="checkbox" id="f-${key}" ${value !== false ? 'checked' : ''} />
        <span class="hint">When unchecked, entry is hidden from the public timeline.</span>
      </div>`;
  } else if (isTags) {
    const tags = Array.isArray(value) ? value : [];
    widget = `
      <div class="field-tags" data-field="tags">
        ${tags.map((t, i) => `<span class="tag-pill">${escapeHtml(t)}<button type="button" data-idx="${i}" title="Remove">×</button></span>`).join('')}
        <input type="text" placeholder="+ add tag" id="f-tags-input" />
      </div>`;
  } else if (isLong) {
    widget = `<textarea id="f-${key}" class="${key === 'transcript' ? 'transcript' : ''}">${escapeHtml(value || '')}</textarea>`;
  } else if (isEnum && enumValues(key, state.collection)) {
    const opts = enumValues(key, state.collection);
    widget = `
      <select id="f-${key}">
        <option value="">—</option>
        ${opts.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
      </select>`;
  } else {
    widget = `<input type="text" id="f-${key}" value="${escapeHtml(value ?? '')}" />`;
  }

  let hint = '';
  if (key === 'preservedTitle') hint = `<div class="hint important">Colin's original typography — preserve exactly.</div>`;
  else if (key === 'date') hint = `<div class="hint">Accepts YYYY, YYYY-MM, or YYYY-MM-DD.</div>`;
  else if (key === 'summary') hint = `<div class="hint important">Curator voice only — no AI-generated text.</div>`;
  else if (key === 'archivePath') hint = `<div class="hint">Path inside the Dropbox archive (starts with "CRFW Archive/…").</div>`;

  return `
    <div class="field" data-key="${key}">
      <label for="f-${key}">${key}</label>
      ${widget}
      ${hint}
    </div>`;
}

function enumValues(key, collection) {
  const ENUMS = {
    releases_format: ['LP','EP','single','mix','compilation','b-sides','demo','other'],
    releases_bandcampItemType: ['album','track'],
    photos_source:   ['archive','instagram','press','friend','unknown'],
    videos_kind:     ['music video','live','rehearsal','interview','home','other'],
    events_kind:     ['life','show','release','milestone','residence','collaboration','press'],
  };
  return ENUMS[`${collection}_${key}`];
}

// ---------------------------------------------------------------
// Wire editor interactions
// ---------------------------------------------------------------
function wireEditor() {
  editorBody.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', () => { state.dirty = true; updateStatus('Unsaved'); });
    el.addEventListener('change', () => { state.dirty = true; updateStatus('Unsaved'); });
  });

  // Tag add/remove
  const tagInput = $('f-tags-input');
  if (tagInput) {
    tagInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = tagInput.value.trim();
        if (val) {
          state.current.data.tags = [...(state.current.data.tags || []), val];
          state.dirty = true;
          rerenderTagsField();
        }
      }
    });
  }
  editorBody.querySelectorAll('.field-tags .tag-pill button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      state.current.data.tags.splice(idx, 1);
      state.dirty = true;
      rerenderTagsField();
    });
  });

  // Unpublished toggle
  const unpubBtn = $('btn-mark-unpublished');
  if (unpubBtn) {
    unpubBtn.addEventListener('click', () => {
      const cb = $('f-published');
      if (cb) cb.checked = !cb.checked;
      state.dirty = true;
      updateStatus('Unsaved');
    });
  }

  $('btn-cancel').addEventListener('click', () => {
    if (!state.dirty || confirm('Discard changes?')) {
      state.dirty = false;
      renderEditor();
    }
  });
  $('btn-save').addEventListener('click', saveEntry);
}

function rerenderTagsField() {
  const fieldEl = editorBody.querySelector('.field[data-key="tags"]');
  if (!fieldEl) return;
  fieldEl.outerHTML = renderField('tags', state.current.data.tags);
  // Re-wire the newly rendered inputs
  wireEditor();
}

function updateStatus(text) {
  const el = $('save-status');
  if (el) el.textContent = text;
}

// ---------------------------------------------------------------
// Save
// ---------------------------------------------------------------
async function saveEntry() {
  const entry = state.current;
  const fields = entry.editableFields || [];
  const data = {};
  for (const key of fields) {
    const el = $(`f-${key}`);
    if (!el) {
      // Tags stays in state.current.data.tags; read from there
      if (key === 'tags') data.tags = state.current.data.tags || [];
      continue;
    }
    if (el.type === 'checkbox') data[key] = el.checked;
    else data[key] = el.value;
  }

  updateStatus('Saving…');
  $('btn-save').disabled = true;

  const resp = await fetch(`${API}/entries/${entry.collection}/${entry.slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, commit: true }),
  }).then(r => r.json());

  $('btn-save').disabled = false;

  if (resp.error) {
    updateStatus('');
    toast('Error: ' + resp.error, true);
    return;
  }
  if (resp.changed.length === 0) {
    updateStatus('No changes');
    return;
  }
  state.dirty = false;
  const msg = resp.commit?.committed
    ? `Saved + committed (${resp.changed.length} fields)`
    : `Saved — commit failed: ${resp.commit?.error || 'unknown'}`;
  updateStatus(msg);
  toast(msg, !resp.commit?.committed);

  // Reload entry to pick up server-side normalization
  await selectEntry(entry.slug);
}

// ---------------------------------------------------------------
// Toast
// ---------------------------------------------------------------
function toast(msg, isError) {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.hidden = true, 4000);
}

// ---------------------------------------------------------------
// Search
// ---------------------------------------------------------------
searchInput.addEventListener('input', e => {
  state.search = e.target.value;
  renderList();
});

// ---------------------------------------------------------------
// Utility
// ---------------------------------------------------------------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------------------------------------------------------------
// Warn on leave if dirty
// ---------------------------------------------------------------
window.addEventListener('beforeunload', e => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Boot
loadCollections();
