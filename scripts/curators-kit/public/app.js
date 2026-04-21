// Curator's Kit — frontend SPA (vanilla, no build step).
// Communicates with the local server via /api/*. Every save
// commits to git; the curator pushes when ready.

const API = '/api';
const state = {
  source: 'site',            // 'site' | 'vault' (Session 13)
  sources: [],               // from /api/sources
  collection: null,
  entries: [],
  selectedSlug: null,
  current: null,             // full entry with editableFields
  dirty: false,
  search: '',
  viewMode: 'list',          // 'list' | 'grid'
  selected: new Set(),       // Set<slug> for multi-select
  filterPublished: 'all',    // 'all' | 'published' | 'unpublished'
  allSets: [],               // lightweight set entries cached for membership lookup
  setsLoaded: false,
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
// Load sources + collection list
// ---------------------------------------------------------------
async function loadCollections() {
  // Fetch the multi-source manifest
  state.sources = await fetch(`${API}/sources`).then(r => r.json());
  renderSourceSwitcher();
  renderCollectionSidebar();
}

function renderSourceSwitcher() {
  let el = $('source-switcher');
  if (!el) {
    el = document.createElement('div');
    el.id = 'source-switcher';
    el.className = 'source-switcher';
    const sidebarHead = document.querySelector('.sidebar-head');
    if (sidebarHead) sidebarHead.after(el);
  }
  el.innerHTML = state.sources.map(s => `
    <button data-source="${s.id}" class="source-btn ${state.source === s.id ? 'active' : ''}">
      ${s.label}
      <span class="source-hint">${s.commits ? 'git' : 'vault'}</span>
    </button>
  `).join('');
  el.querySelectorAll('.source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.dirty && !confirm('Discard unsaved changes?')) return;
      state.source = btn.dataset.source;
      state.collection = null;
      state.selectedSlug = null;
      state.current = null;
      state.selected.clear();
      state.entries = [];
      listTitle.textContent = 'Choose a collection';
      renderSourceSwitcher();
      renderCollectionSidebar();
      renderEmpty();
      listEl.innerHTML = '';
      const tb = $('list-toolbar'); if (tb) tb.innerHTML = '';
      const bb = $('bulk-bar'); if (bb) { bb.innerHTML = ''; bb.hidden = true; }
    });
  });
}

function renderCollectionSidebar() {
  const activeSource = state.sources.find(s => s.id === state.source);
  if (!activeSource) return;
  sidebar.innerHTML = '';
  for (const c of activeSource.collections) {
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
  state.selected.clear();
  // Default to grid view for photos + videos (visual collections)
  state.viewMode = (name === 'photos' || name === 'videos' || name === 'sets') ? 'grid' : 'list';
  listTitle.textContent = name.replace(/_/g, ' ');
  document.querySelectorAll('#collections button').forEach(b =>
    b.classList.toggle('active', b.dataset.collection === name));
  renderEmpty();
  state.entries = await fetch(`${API}/entries/${state.source}/${name}`).then(r => r.json());
  // Sort newest first
  state.entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  renderToolbar();
  renderList();
}

function currentlyFiltered() {
  const q = state.search.toLowerCase().trim();
  return state.entries.filter(e => {
    if (state.filterPublished === 'published' && !e.published) return false;
    if (state.filterPublished === 'unpublished' && e.published) return false;
    if (!q) return true;
    return (
      (e.title || '').toLowerCase().includes(q) ||
      (e.project || '').toLowerCase().includes(q) ||
      (e.captionPreview || '').toLowerCase().includes(q) ||
      (e.slug || '').toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.toLowerCase().includes(q))
    );
  });
}

function renderToolbar() {
  const toolbar = $('list-toolbar');
  if (!toolbar) return;
  const total = state.entries.length;
  const pub = state.entries.filter(e => e.published).length;
  const draft = total - pub;
  toolbar.innerHTML = `
    <div class="toolbar-row">
      <div class="toolbar-stat"><strong>${total}</strong> total · ${pub} published · ${draft} draft</div>
      <div class="toolbar-spacer"></div>
      <button class="view-toggle ${state.viewMode === 'list' ? 'active' : ''}" data-view="list" title="List view">☰</button>
      <button class="view-toggle ${state.viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid view">▦</button>
    </div>
    <div class="toolbar-row">
      <select class="status-filter" id="status-filter">
        <option value="all" ${state.filterPublished === 'all' ? 'selected' : ''}>All status</option>
        <option value="published" ${state.filterPublished === 'published' ? 'selected' : ''}>Published only</option>
        <option value="unpublished" ${state.filterPublished === 'unpublished' ? 'selected' : ''}>Unpublished only</option>
      </select>
    </div>`;
  toolbar.querySelectorAll('.view-toggle').forEach(btn =>
    btn.addEventListener('click', () => {
      state.viewMode = btn.dataset.view;
      state.selected.clear();
      renderToolbar();
      renderList();
    }));
  const sf = toolbar.querySelector('#status-filter');
  if (sf) sf.addEventListener('change', e => {
    state.filterPublished = e.target.value;
    renderList();
  });
}

function renderList() {
  const filtered = currentlyFiltered();
  listEl.innerHTML = '';
  listEl.className = 'entry-list view-' + state.viewMode;
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="list-empty">No entries match</div>`;
    renderBulkBar();
    return;
  }
  if (state.viewMode === 'grid') {
    renderGridView(filtered);
  } else {
    renderListView(filtered);
  }
  renderBulkBar();
}

function renderListView(filtered) {
  for (const e of filtered) {
    const item = document.createElement('div');
    item.className = 'entry-item' + (e.published ? '' : ' unpublished') +
      (state.selectedSlug === e.slug ? ' active' : '') +
      (state.selected.has(e.slug) ? ' selected' : '');
    item.dataset.slug = e.slug;
    item.innerHTML = `
      <label class="entry-check"><input type="checkbox" ${state.selected.has(e.slug) ? 'checked' : ''}/></label>
      <div class="entry-body">
        <div class="entry-title">${escapeHtml(e.title || e.slug)}</div>
        <div class="entry-meta">
          <span>${escapeHtml(e.date || '')}</span>
          <span>${escapeHtml(e.project || '')}</span>
          ${e.format ? `<span>${escapeHtml(e.format)}</span>` : ''}
        </div>
      </div>`;
    item.querySelector('input[type=checkbox]').addEventListener('change', ev => {
      ev.stopPropagation();
      if (ev.target.checked) state.selected.add(e.slug); else state.selected.delete(e.slug);
      item.classList.toggle('selected', ev.target.checked);
      renderBulkBar();
    });
    item.querySelector('.entry-body').addEventListener('click', () => selectEntry(e.slug));
    listEl.appendChild(item);
  }
}

function renderGridView(filtered) {
  for (const e of filtered) {
    const item = document.createElement('div');
    item.className = 'grid-item' + (e.published ? '' : ' unpublished') +
      (state.selected.has(e.slug) ? ' selected' : '') +
      (state.selectedSlug === e.slug ? ' active' : '');
    item.dataset.slug = e.slug;
    const thumbUrl = e.thumb ? (e.thumb.startsWith('/media/') ? e.thumb : '/media/' + e.thumb.replace(/^\//, '')) : '';
    const thumbHtml = thumbUrl
      ? `<img class="grid-thumb" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
      : `<div class="grid-thumb grid-thumb-empty">${escapeHtml((e.format || e.title || '').slice(0, 16))}</div>`;
    item.innerHTML = `
      <label class="grid-check"><input type="checkbox" ${state.selected.has(e.slug) ? 'checked' : ''}/></label>
      <div class="grid-pub-badge ${e.published ? 'is-pub' : 'is-draft'}" title="${e.published ? 'Published' : 'Draft'}">${e.published ? '●' : '○'}</div>
      ${thumbHtml}
      <div class="grid-caption">
        <div class="grid-title">${escapeHtml(e.title || e.slug)}</div>
        <div class="grid-meta">${escapeHtml(e.date || '')} · ${escapeHtml(e.project || '—')}</div>
        ${e.captionPreview ? `<div class="grid-preview">${escapeHtml(e.captionPreview)}</div>` : ''}
      </div>`;
    item.querySelector('input[type=checkbox]').addEventListener('change', ev => {
      ev.stopPropagation();
      if (ev.target.checked) state.selected.add(e.slug); else state.selected.delete(e.slug);
      item.classList.toggle('selected', ev.target.checked);
      renderBulkBar();
    });
    // Click anywhere on the card (not the checkbox) opens the editor
    item.addEventListener('click', ev => {
      if (ev.target.closest('.grid-check')) return;
      selectEntry(e.slug);
    });
    listEl.appendChild(item);
  }
}

function renderBulkBar() {
  const bar = $('bulk-bar');
  if (!bar) return;
  const n = state.selected.size;
  if (n === 0) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  const uniqueProjects = [...new Set(state.entries.map(e => e.project).filter(Boolean))];
  bar.innerHTML = `
    <span class="bulk-count"><strong>${n}</strong> selected</span>
    <button class="bulk-btn bulk-publish" title="Set published: true">▶ Publish</button>
    <button class="bulk-btn bulk-unpublish" title="Set published: false">■ Unpublish</button>
    <span class="bulk-sep">·</span>
    <label class="bulk-inline">
      <span>Project:</span>
      <select class="bulk-project-sel">
        <option value="">—</option>
        ${uniqueProjects.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
      </select>
      <button class="bulk-btn bulk-set-project">Set</button>
    </label>
    <label class="bulk-inline">
      <span>Add tag:</span>
      <input type="text" class="bulk-tag-input" placeholder="e.g. reviewed" />
      <button class="bulk-btn bulk-add-tag">Add</button>
    </label>
    <span class="bulk-spacer"></span>
    ${(state.collection === 'photos' || state.collection === 'videos') ? `
    <span id="bulk-set-area">
      <button class="bulk-btn" id="bulk-group-btn">+ Set</button>
    </span>` : ''}
    <button class="bulk-btn bulk-clear">Clear</button>`;

  bar.querySelector('.bulk-publish').addEventListener('click', () => bulkApply({ published: true }, 'publish'));
  bar.querySelector('.bulk-unpublish').addEventListener('click', () => bulkApply({ published: false }, 'unpublish'));
  bar.querySelector('.bulk-set-project').addEventListener('click', () => {
    const v = bar.querySelector('.bulk-project-sel').value;
    if (!v) return toast('Pick a project first', true);
    bulkApply({ project: v }, `set project=${v}`);
  });
  bar.querySelector('.bulk-add-tag').addEventListener('click', () => {
    const tag = bar.querySelector('.bulk-tag-input').value.trim();
    if (!tag) return toast('Enter a tag first', true);
    bulkAddTag(tag);
  });
  bar.querySelector('.bulk-clear').addEventListener('click', () => {
    state.selected.clear();
    renderList();
  });

  const groupBtn = document.getElementById('bulk-group-btn');
  if (groupBtn) groupBtn.addEventListener('click', showGroupSetForm);
}

function showGroupSetForm() {
  const area = document.getElementById('bulk-set-area');
  if (!area) return;
  area.innerHTML = `
    <input id="bulk-set-name" class="bulk-set-input" placeholder="Set name…" />
    <button class="bulk-btn" id="bulk-set-create">Create</button>
    <button class="bulk-btn" id="bulk-set-cancel">✕</button>`;
  document.getElementById('bulk-set-create').addEventListener('click', async () => {
    const name = document.getElementById('bulk-set-name')?.value.trim();
    if (name) await createSet(name);
  });
  document.getElementById('bulk-set-cancel').addEventListener('click', renderBulkBar);
  document.getElementById('bulk-set-name')?.focus();
}

function slugify(str) {
  const base = str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  const ts = Date.now().toString(36).slice(-4);
  return `${base}-${ts}`;
}

async function loadAllSets() {
  if (state.setsLoaded) return;
  try {
    state.allSets = await fetch(`${API}/entries/site/sets`).then(r => r.json());
    state.setsLoaded = true;
  } catch (e) { state.allSets = []; }
}

async function createSet(name) {
  const slug = slugify(name);
  const kind = state.collection === 'videos' ? 'video' : 'photo';
  const slugs = [...state.selected];
  const members = slugs.map(s => ({ kind, slug: s }));
  const dates = slugs.map(s => state.entries.find(e => e.slug === s)?.date).filter(Boolean).sort();
  const data = { name, date: dates[0] || '', members, tags: [], published: false };

  toast(`Creating set "${name}"…`);
  const r = await fetch(`${API}/entries/site/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, data }),
  }).then(r => r.json());

  if (r.error) return toast('Error: ' + r.error, true);
  state.setsLoaded = false;  // invalidate cache
  state.selected.clear();
  toast(`Set "${name}" created.`);
  await selectCollection('sets');
  selectEntry(slug);
}

async function bulkApply(patch, summary) {
  const slugs = [...state.selected];
  const confirmMsg = `${summary} on ${slugs.length} ${state.collection}?`;
  if (!confirm(confirmMsg)) return;
  toast(`Applying to ${slugs.length}…`);
  const r = await fetch(`${API}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: state.source, collection: state.collection, slugs, patch, summary }),
  }).then(r => r.json());
  if (r.error) return toast('Error: ' + r.error, true);
  // Refresh list with new values (don't reload from server for speed;
  // patch the in-memory entries directly)
  for (const u of r.updated) {
    const e = state.entries.find(x => x.slug === u.slug);
    if (!e) continue;
    if ('published' in patch) e.published = patch.published;
    if ('project' in patch) e.project = patch.project;
  }
  state.selected.clear();
  renderToolbar();
  renderList();
  const msg = `${r.updated.length} updated, ${r.unchanged.length} unchanged${r.errors.length ? `, ${r.errors.length} errors` : ''}. ${r.commit?.committed ? 'Committed.' : ''}`;
  toast(msg, r.errors.length > 0);
}

async function bulkAddTag(tag) {
  const slugs = [...state.selected];
  // Fetch each entry's current tags, append, PATCH via bulk endpoint
  // (simpler: do individual PATCHes for this one since tags vary per-entry)
  toast(`Adding tag "${tag}" to ${slugs.length}…`);
  let ok = 0, err = 0;
  for (const slug of slugs) {
    const e = state.entries.find(x => x.slug === slug);
    if (!e) continue;
    const nextTags = Array.from(new Set([...(e.tags || []), tag]));
    const r = await fetch(`${API}/entries/${state.source}/${state.collection}/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { tags: nextTags }, commit: false }),
    }).then(r => r.json()).catch(() => ({ error: 'network' }));
    if (r.error) err++; else { ok++; e.tags = nextTags; }
  }
  // One git commit at the end (site only; vault saves are committed implicitly or not at all)
  await fetch(`${API}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: state.source, collection: state.collection, slugs, patch: {}, summary: `add tag ${tag}` }),
  });
  state.selected.clear();
  renderList();
  toast(`Added "${tag}" to ${ok}${err ? ` (${err} errors)` : ''}`, err > 0);
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
  const entry = await fetch(`${API}/entries/${state.source}/${state.collection}/${slug}`).then(r => r.json());
  if (entry.error) { toast('Failed to load entry: ' + entry.error, true); return; }
  state.current = entry;
  renderEditor();
}

function renderEmpty() {
  editorEmpty.hidden = false;
  editorBody.hidden = true;
  editorBody.innerHTML = '';
}

async function renderEditor() {
  const entry = state.current;
  editorEmpty.hidden = true;
  editorBody.hidden = false;

  const d = entry.data;
  const fields = entry.editableFields || [];

  const title = d.title || d.name || entry.slug;
  const parts = [];

  parts.push(`<h1 class="editor-title">${escapeHtml(title)}</h1>`);
  parts.push(`<div class="editor-subtitle">${escapeHtml(entry.collection)} / ${escapeHtml(entry.slug)} · ${escapeHtml(entry.path)}</div>`);

  // Media preview (v2) — cover art / src / poster / local video
  const mediaUrl = d.coverArt || d.src || d.poster || d.localSrc;
  if (mediaUrl) {
    const url = mediaUrl.startsWith('/media/') ? mediaUrl : '/media/' + mediaUrl.replace(/^\//, '');
    const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(mediaUrl);
    parts.push(`<div class="editor-preview">
      ${isVideo
        ? `<video src="${escapeHtml(url)}" controls></video>`
        : `<img src="${escapeHtml(url)}" alt="" />`}
    </div>`);
  }

  for (const key of fields) {
    if (key === 'members') continue; // rendered separately below
    parts.push(renderField(key, d[key]));
  }

  // Set members panel — rendered as HTML but wired after innerHTML is set
  if (entry.collection === 'sets') {
    parts.push(renderSetMembersPanel(d.members || []));
  }

  // Actions — Save button label depends on destination
  const commits = entry.commits !== false;
  const saveLabel = commits ? 'Save & Commit' : 'Save (vault)';
  const saveTitle = commits
    ? 'Write to site content + git commit'
    : 'Write directly to the vault file in Dropbox (no git commit)';
  parts.push(`
    <div class="actions">
      <button class="btn" id="btn-mark-unpublished" title="Hide from public timeline">
        ${d.published === false ? 'Mark Published' : 'Mark Unpublished'}
      </button>
      <div class="spacer"></div>
      <span class="status" id="save-status"></span>
      <button class="btn" id="btn-cancel">Cancel</button>
      <button class="btn btn-primary" id="btn-save" title="${saveTitle}">${saveLabel}</button>
    </div>
  `);

  editorBody.innerHTML = parts.join('');
  wireEditor();

  // Wire set members panel (click-to-jump + remove buttons)
  if (entry.collection === 'sets') {
    wireMemberPanel();
  }

  // "IN SETS" chips for photo/video entries
  if (entry.collection === 'photos' || entry.collection === 'videos') {
    await loadAllSets();
    const memberSets = state.allSets.filter(s =>
      (s.members || []).some(m => m.slug === entry.slug)
    );
    if (memberSets.length > 0) {
      editorBody.insertAdjacentHTML('beforeend', renderSetChips(memberSets));
      editorBody.querySelectorAll('.set-chip[data-slug]').forEach(chip => {
        chip.addEventListener('click', async () => {
          await selectCollection('sets');
          selectEntry(chip.dataset.slug);
        });
      });
    }
  }
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
// Set helpers — members panel + membership chips
// ---------------------------------------------------------------
function renderSetMembersPanel(members) {
  if (!members.length) {
    return `<div class="set-members-panel">
      <div class="panel-label">Members</div>
      <div class="set-members-empty">No members yet. Use the bulk "+ Set" action in Photos or Videos to add assets.</div>
    </div>`;
  }
  const rows = members.map((m, i) => `
    <div class="set-member-row" data-kind="${escapeHtml(m.kind)}" data-slug="${escapeHtml(m.slug)}">
      <span class="member-kind-badge">${escapeHtml(m.kind)}</span>
      <span class="member-slug-text">${escapeHtml(m.slug)}</span>
      <button type="button" class="member-remove" data-idx="${i}" title="Remove from set">×</button>
    </div>`).join('');
  return `<div class="set-members-panel">
    <div class="panel-label">Members (${members.length})</div>
    <div class="set-members-list">${rows}</div>
  </div>`;
}

function wireMemberPanel() {
  const panel = editorBody.querySelector('.set-members-panel');
  if (!panel) return;
  panel.querySelectorAll('.member-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const i = +btn.dataset.idx;
      state.current.data.members.splice(i, 1);
      state.dirty = true;
      updateStatus('Unsaved');
      const newPanel = renderSetMembersPanel(state.current.data.members);
      panel.outerHTML = newPanel;
      wireMemberPanel();
    });
  });
  panel.querySelectorAll('.set-member-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.member-remove')) return;
      jumpToMember(row.dataset.kind, row.dataset.slug);
    });
  });
}

async function jumpToMember(kind, slug) {
  const coll = kind === 'photo' ? 'photos' : kind === 'video' ? 'videos' : 'voice_memos';
  if (state.collection !== coll) await selectCollection(coll);
  selectEntry(slug);
}

function renderSetChips(memberSets) {
  const chips = memberSets.map(s => `
    <button type="button" class="set-chip" data-slug="${escapeHtml(s.slug)}">
      ${escapeHtml(s.title || s.slug)} · ${(s.members || []).length} items
    </button>`).join('');
  return `<div class="set-membership">
    <div class="panel-label">In sets</div>
    <div class="set-chips">${chips}</div>
  </div>`;
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
      // Tags and members are managed via custom widgets, not form inputs
      if (key === 'tags') data.tags = state.current.data.tags || [];
      if (key === 'members') data.members = state.current.data.members || [];
      continue;
    }
    if (el.type === 'checkbox') data[key] = el.checked;
    else data[key] = el.value;
  }

  updateStatus('Saving…');
  $('btn-save').disabled = true;

  const resp = await fetch(`${API}/entries/${entry.source || state.source}/${entry.collection}/${entry.slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, commit: entry.commits !== false }),
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

// ---------------------------------------------------------------
// Keyboard shortcuts (v2)
// ---------------------------------------------------------------
//   p / shift-p   publish selected / current
//   d / shift-d   unpublish (draft) selected / current
//   j / k         next / prev entry in list
//   /             focus search
//   esc           clear selection
document.addEventListener('keydown', e => {
  // Don't hijack when typing in an input/textarea
  const t = e.target;
  const isInput = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
  if (isInput && e.key !== 'Escape') return;

  if (e.key === '/') { e.preventDefault(); searchInput.focus(); return; }
  if (e.key === 'Escape') {
    if (state.selected.size > 0) {
      state.selected.clear();
      renderList();
      return;
    }
  }
  if (e.key === 'j' || e.key === 'k') {
    const filtered = currentlyFiltered();
    if (filtered.length === 0) return;
    const cur = filtered.findIndex(x => x.slug === state.selectedSlug);
    const next = e.key === 'j' ? (cur < 0 ? 0 : Math.min(cur + 1, filtered.length - 1))
                               : (cur <= 0 ? 0 : cur - 1);
    selectEntry(filtered[next].slug);
    return;
  }
  if (e.key === 'p' || e.key === 'd') {
    const slugs = state.selected.size > 0 ? [...state.selected] :
                  (state.selectedSlug ? [state.selectedSlug] : []);
    if (slugs.length === 0) return;
    const targetPub = e.key === 'p';
    e.preventDefault();
    // Temporarily use state.selected to reuse bulkApply
    if (state.selected.size === 0) state.selected.add(state.selectedSlug);
    bulkApply({ published: targetPub }, targetPub ? 'publish' : 'unpublish');
  }
});

// Boot
loadCollections();
