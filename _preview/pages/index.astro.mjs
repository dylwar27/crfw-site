import { c as createAstro, a as createComponent, r as renderHead, b as renderSlot, d as renderTemplate, A as AstroError, U as UnknownContentCollectionError, e as renderUniqueStylesheet, f as renderScriptElement, g as createHeadAndContent, h as renderComponent, u as unescapeHTML, i as addAttribute, m as maybeRenderHead } from '../chunks/astro/server_BemJfg4n.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                                 */
import { Traverse } from 'neotraverse/modern';
import pLimit from 'p-limit';
import { removeBase, prependForwardSlash } from '@astrojs/internal-helpers/path';
import { i as isCoreRemotePath, V as VALID_INPUT_FORMATS } from '../chunks/astro/assets-service_lzFWa4op.mjs';
import * as devalue from 'devalue';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://crfw.example");
const $$Base = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Base;
  const { title = "Colin Ward / CRFW" } = Astro2.props;
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description" content="An archive and timeline of the work of Colin Ward (CRFW / killd by / alphabets).">${renderHead()}</head> <body> ${renderSlot($$result, $$slots["default"])} </body></html>`;
}, "/sessions/amazing-keen-gates/mnt/outputs/crfw-site/src/layouts/Base.astro", void 0);

const CONTENT_IMAGE_FLAG = "astroContentImageFlag";
const IMAGE_IMPORT_PREFIX = "__ASTRO_IMAGE_";

function imageSrcToImportId(imageSrc, filePath) {
  imageSrc = removeBase(imageSrc, IMAGE_IMPORT_PREFIX);
  if (isCoreRemotePath(imageSrc)) {
    return;
  }
  const ext = imageSrc.split(".").at(-1);
  if (!ext || !VALID_INPUT_FORMATS.includes(ext)) {
    return;
  }
  const params = new URLSearchParams(CONTENT_IMAGE_FLAG);
  if (filePath) {
    params.set("importer", filePath);
  }
  return `${imageSrc}?${params.toString()}`;
}

class DataStore {
  _collections = /* @__PURE__ */ new Map();
  constructor() {
    this._collections = /* @__PURE__ */ new Map();
  }
  get(collectionName, key) {
    return this._collections.get(collectionName)?.get(String(key));
  }
  entries(collectionName) {
    const collection = this._collections.get(collectionName) ?? /* @__PURE__ */ new Map();
    return [...collection.entries()];
  }
  values(collectionName) {
    const collection = this._collections.get(collectionName) ?? /* @__PURE__ */ new Map();
    return [...collection.values()];
  }
  keys(collectionName) {
    const collection = this._collections.get(collectionName) ?? /* @__PURE__ */ new Map();
    return [...collection.keys()];
  }
  has(collectionName, key) {
    const collection = this._collections.get(collectionName);
    if (collection) {
      return collection.has(String(key));
    }
    return false;
  }
  hasCollection(collectionName) {
    return this._collections.has(collectionName);
  }
  collections() {
    return this._collections;
  }
  /**
   * Attempts to load a DataStore from the virtual module.
   * This only works in Vite.
   */
  static async fromModule() {
    try {
      const data = await import('../chunks/_astro_data-layer-content_BcEe_9wP.mjs');
      if (data.default instanceof Map) {
        return DataStore.fromMap(data.default);
      }
      const map = devalue.unflatten(data.default);
      return DataStore.fromMap(map);
    } catch {
    }
    return new DataStore();
  }
  static async fromMap(data) {
    const store = new DataStore();
    store._collections = data;
    return store;
  }
}
function dataStoreSingleton() {
  let instance = void 0;
  return {
    get: async () => {
      if (!instance) {
        instance = DataStore.fromModule();
      }
      return instance;
    },
    set: (store) => {
      instance = store;
    }
  };
}
const globalDataStore = dataStoreSingleton();

const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": "https://crfw.example", "SSR": true};
function createCollectionToGlobResultMap({
  globResult,
  contentDir
}) {
  const collectionToGlobResultMap = {};
  for (const key in globResult) {
    const keyRelativeToContentDir = key.replace(new RegExp(`^${contentDir}`), "");
    const segments = keyRelativeToContentDir.split("/");
    if (segments.length <= 1) continue;
    const collection = segments[0];
    collectionToGlobResultMap[collection] ??= {};
    collectionToGlobResultMap[collection][key] = globResult[key];
  }
  return collectionToGlobResultMap;
}
function createGetCollection({
  contentCollectionToEntryMap,
  dataCollectionToEntryMap,
  getRenderEntryImport,
  cacheEntriesByCollection
}) {
  return async function getCollection(collection, filter) {
    const hasFilter = typeof filter === "function";
    const store = await globalDataStore.get();
    let type;
    if (collection in contentCollectionToEntryMap) {
      type = "content";
    } else if (collection in dataCollectionToEntryMap) {
      type = "data";
    } else if (store.hasCollection(collection)) {
      const { default: imageAssetMap } = await import('../chunks/_astro_asset-imports_D9aVaOQr.mjs');
      const result = [];
      for (const rawEntry of store.values(collection)) {
        const data = updateImageReferencesInData(rawEntry.data, rawEntry.filePath, imageAssetMap);
        const entry = {
          ...rawEntry,
          data,
          collection
        };
        if (hasFilter && !filter(entry)) {
          continue;
        }
        result.push(entry);
      }
      return result;
    } else {
      console.warn(
        `The collection ${JSON.stringify(
          collection
        )} does not exist or is empty. Ensure a collection directory with this name exists.`
      );
      return [];
    }
    const lazyImports = Object.values(
      type === "content" ? contentCollectionToEntryMap[collection] : dataCollectionToEntryMap[collection]
    );
    let entries = [];
    if (!Object.assign(__vite_import_meta_env__, { _: process.env._ })?.DEV && cacheEntriesByCollection.has(collection)) {
      entries = cacheEntriesByCollection.get(collection);
    } else {
      const limit = pLimit(10);
      entries = await Promise.all(
        lazyImports.map(
          (lazyImport) => limit(async () => {
            const entry = await lazyImport();
            return type === "content" ? {
              id: entry.id,
              slug: entry.slug,
              body: entry.body,
              collection: entry.collection,
              data: entry.data,
              async render() {
                return render({
                  collection: entry.collection,
                  id: entry.id,
                  renderEntryImport: await getRenderEntryImport(collection, entry.slug)
                });
              }
            } : {
              id: entry.id,
              collection: entry.collection,
              data: entry.data
            };
          })
        )
      );
      cacheEntriesByCollection.set(collection, entries);
    }
    if (hasFilter) {
      return entries.filter(filter);
    } else {
      return entries.slice();
    }
  };
}
function updateImageReferencesInData(data, fileName, imageAssetMap) {
  return new Traverse(data).map(function(ctx, val) {
    if (typeof val === "string" && val.startsWith(IMAGE_IMPORT_PREFIX)) {
      const src = val.replace(IMAGE_IMPORT_PREFIX, "");
      const id = imageSrcToImportId(src, fileName);
      if (!id) {
        ctx.update(src);
        return;
      }
      const imported = imageAssetMap?.get(id);
      if (imported) {
        ctx.update(imported);
      } else {
        ctx.update(src);
      }
    }
  });
}
async function render({
  collection,
  id,
  renderEntryImport
}) {
  const UnexpectedRenderError = new AstroError({
    ...UnknownContentCollectionError,
    message: `Unexpected error while rendering ${String(collection)} → ${String(id)}.`
  });
  if (typeof renderEntryImport !== "function") throw UnexpectedRenderError;
  const baseMod = await renderEntryImport();
  if (baseMod == null || typeof baseMod !== "object") throw UnexpectedRenderError;
  const { default: defaultMod } = baseMod;
  if (isPropagatedAssetsModule(defaultMod)) {
    const { collectedStyles, collectedLinks, collectedScripts, getMod } = defaultMod;
    if (typeof getMod !== "function") throw UnexpectedRenderError;
    const propagationMod = await getMod();
    if (propagationMod == null || typeof propagationMod !== "object") throw UnexpectedRenderError;
    const Content = createComponent({
      factory(result, baseProps, slots) {
        let styles = "", links = "", scripts = "";
        if (Array.isArray(collectedStyles)) {
          styles = collectedStyles.map((style) => {
            return renderUniqueStylesheet(result, {
              type: "inline",
              content: style
            });
          }).join("");
        }
        if (Array.isArray(collectedLinks)) {
          links = collectedLinks.map((link) => {
            return renderUniqueStylesheet(result, {
              type: "external",
              src: prependForwardSlash(link)
            });
          }).join("");
        }
        if (Array.isArray(collectedScripts)) {
          scripts = collectedScripts.map((script) => renderScriptElement(script)).join("");
        }
        let props = baseProps;
        if (id.endsWith("mdx")) {
          props = {
            components: propagationMod.components ?? {},
            ...baseProps
          };
        }
        return createHeadAndContent(
          unescapeHTML(styles + links + scripts),
          renderTemplate`${renderComponent(
            result,
            "Content",
            propagationMod.Content,
            props,
            slots
          )}`
        );
      },
      propagation: "self"
    });
    return {
      Content,
      headings: propagationMod.getHeadings?.() ?? [],
      remarkPluginFrontmatter: propagationMod.frontmatter ?? {}
    };
  } else if (baseMod.Content && typeof baseMod.Content === "function") {
    return {
      Content: baseMod.Content,
      headings: baseMod.getHeadings?.() ?? [],
      remarkPluginFrontmatter: baseMod.frontmatter ?? {}
    };
  } else {
    throw UnexpectedRenderError;
  }
}
function isPropagatedAssetsModule(module) {
  return typeof module === "object" && module != null && "__astroPropagation" in module;
}

// astro-head-inject

const contentDir = '/src/content/';

const contentEntryGlob = /* #__PURE__ */ Object.assign({"/src/content/events/archive-begins.md": () => import('../chunks/archive-begins_BZOWYsu9.mjs'),"/src/content/releases/alphabets-2010.md": () => import('../chunks/alphabets-2010_D4V7Y4kz.mjs'),"/src/content/releases/court-clothes.md": () => import('../chunks/court-clothes_BJXW7_ak.mjs'),"/src/content/releases/recovery.md": () => import('../chunks/recovery_Bs6E-dRh.mjs')});
const contentCollectionToEntryMap = createCollectionToGlobResultMap({
	globResult: contentEntryGlob,
	contentDir,
});

const dataEntryGlob = /* #__PURE__ */ Object.assign({});
const dataCollectionToEntryMap = createCollectionToGlobResultMap({
	globResult: dataEntryGlob,
	contentDir,
});
createCollectionToGlobResultMap({
	globResult: { ...contentEntryGlob, ...dataEntryGlob },
	contentDir,
});

let lookupMap = {};
lookupMap = {"events":{"type":"content","entries":{"archive-begins":"/src/content/events/archive-begins.md"}},"releases":{"type":"content","entries":{"court-clothes":"/src/content/releases/court-clothes.md","recovery":"/src/content/releases/recovery.md","alphabets-2010":"/src/content/releases/alphabets-2010.md"}}};

new Set(Object.keys(lookupMap));

function createGlobLookup(glob) {
	return async (collection, lookupId) => {
		const filePath = lookupMap[collection]?.entries[lookupId];

		if (!filePath) return undefined;
		return glob[collection][filePath];
	};
}

const renderEntryGlob = /* #__PURE__ */ Object.assign({"/src/content/events/archive-begins.md": () => import('../chunks/archive-begins_BUqDVP98.mjs'),"/src/content/releases/alphabets-2010.md": () => import('../chunks/alphabets-2010__HVXvF_0.mjs'),"/src/content/releases/court-clothes.md": () => import('../chunks/court-clothes_CD7JE44u.mjs'),"/src/content/releases/recovery.md": () => import('../chunks/recovery_Cz3jQTZc.mjs')});
const collectionToRenderEntryMap = createCollectionToGlobResultMap({
	globResult: renderEntryGlob,
	contentDir,
});

const cacheEntriesByCollection = new Map();
const getCollection = createGetCollection({
	contentCollectionToEntryMap,
	dataCollectionToEntryMap,
	getRenderEntryImport: createGlobLookup(collectionToRenderEntryMap),
	cacheEntriesByCollection,
});

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const releases = await getCollection("releases");
  const events = await getCollection("events");
  const photos = await getCollection("photos");
  const videos = await getCollection("videos");
  const voice_memos = await getCollection("voice_memos");
  const entries = [];
  for (const r of releases) {
    const year = parseInt(r.data.date.slice(0, 4), 10);
    entries.push({
      id: `release--${r.id.replace(/\.(md|mdx)$/, "")}`,
      kind: "release",
      title: r.data.title,
      preservedTitle: r.data.preservedTitle,
      date: r.data.date,
      year,
      project: r.data.project,
      cover: r.data.coverArt,
      // LPs are big cards; everything else smaller
      size: r.data.format === "LP" ? "xl" : r.data.format === "EP" ? "lg" : "md",
      tags: r.data.tags ?? [],
      data: { ...r.data, body: r.body }
    });
  }
  for (const e of events) {
    const year = parseInt(e.data.date.slice(0, 4), 10);
    entries.push({
      id: `event--${e.id.replace(/\.(md|mdx)$/, "")}`,
      kind: "event",
      title: e.data.title,
      date: e.data.date,
      year,
      project: e.data.project ?? "life",
      size: "sm",
      tags: e.data.tags ?? [],
      data: { ...e.data, body: e.body }
    });
  }
  for (const p of photos) {
    const year = parseInt((p.data.date ?? "0000").slice(0, 4), 10);
    if (!year) continue;
    entries.push({
      id: `photo--${p.id}`,
      kind: "photo",
      title: p.data.title ?? "Untitled photo",
      date: p.data.date,
      year,
      project: p.data.project,
      cover: p.data.src,
      size: "sm",
      tags: p.data.tags ?? [],
      data: p.data
    });
  }
  for (const v of videos) {
    const year = parseInt((v.data.date ?? "0000").slice(0, 4), 10);
    if (!year) continue;
    entries.push({
      id: `video--${v.id}`,
      kind: "video",
      title: v.data.title,
      date: v.data.date,
      year,
      project: v.data.project,
      cover: v.data.poster,
      size: "md",
      tags: v.data.tags ?? [],
      data: v.data
    });
  }
  for (const m of voice_memos) {
    const year = parseInt(m.data.date.slice(0, 4), 10);
    entries.push({
      id: `voice--${m.id}`,
      kind: "voice_memo",
      title: m.data.title ?? "Voice memo",
      date: m.data.date,
      year,
      project: m.data.project,
      size: "sm",
      tags: m.data.tags ?? [],
      data: m.data
    });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  const byYear = /* @__PURE__ */ new Map();
  for (const e of entries) {
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year).push(e);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const projects = [...new Set(entries.map((e) => e.project).filter(Boolean))];
  const kinds = [...new Set(entries.map((e) => e.kind))];
  const totals = {
    releases: entries.filter((e) => e.kind === "release").length,
    events: entries.filter((e) => e.kind === "event").length,
    total: entries.length
  };
  return renderTemplate`${renderComponent($$result, "Base", $$Base, { "title": "Colin Ward \u2014 CRFW Archive" }, { "default": async ($$result2) => renderTemplate(_a || (_a = __template([" ", '<header class="masthead"> <h1>COLIN <span class="dim">/</span> WARD <span class="dim">/</span> CRFW</h1> <div class="sub"> ', " entries \xB7 ", " releases \xB7 ", ' \xB7 archive in motion\n</div> </header> <nav class="filters" id="filters"> <span class="filters-label">Project</span> <button class="filter-btn active" data-axis="project" data-value="all">All</button> ', ' <span class="group-sep"></span> <span class="filters-label">Medium</span> <button class="filter-btn active" data-axis="kind" data-value="all">All</button> ', ' </nav> <main class="timeline"> ', ' </main> <footer class="foot">\nCRFW timeline \xB7 proof of concept \xB7 ', ' entries indexed\n</footer>  <div class="popup-scrim" id="popup-scrim" role="dialog" aria-modal="true" aria-labelledby="popup-title"> <div class="popup" id="popup"></div> </div>  <script id="entry-data" type="application/json">', "<\/script> <script>\n    (function () {\n      const raw = document.getElementById('entry-data').textContent;\n      const DATA = JSON.parse(raw);\n      const scrim = document.getElementById('popup-scrim');\n      const popup = document.getElementById('popup');\n\n      function renderPopup(e) {\n        const d = e.data || {};\n        const cover = e.cover || d.coverArt;\n        const trackHtml = (d.tracklist || []).map(t => `\n          <li>\n            <span class=\"n\">${t.n ?? ''}</span>\n            <span>\n              <span class=\"track-title\">${escapeHtml(t.title)}</span>\n              ${t.preservedTitle && t.preservedTitle !== t.title\n                ? `<span class=\"track-preserved\">${escapeHtml(t.preservedTitle)}</span>`\n                : ''}\n            </span>\n          </li>`).join('');\n        const summary = d.summary ? `<div class=\"summary\"><p>${escapeHtml(d.summary)}</p></div>` : '';\n        const bodyHtml = d.body ? `<div class=\"summary\">${simpleMarkdown(d.body)}</div>` : '';\n        const archive = d.archivePath\n          ? `<div class=\"archive-path\">\u{1F4C1} ${escapeHtml(d.archivePath)}</div>` : '';\n        const meta = [\n          d.date || e.date,\n          e.project,\n          d.format,\n          d.era,\n          e.kind,\n        ].filter(Boolean).map(m => `<span>${escapeHtml(m)}</span>`).join('');\n\n        popup.innerHTML = `\n          <button class=\"popup-close\" aria-label=\"Close\" id=\"popup-close\">\xD7</button>\n          <div class=\"popup-header\">\n            ${cover ? `<img class=\"popup-cover\" src=\"${cover}\" alt=\"\" />` : '<div class=\"popup-cover\"></div>'}\n            <div>\n              <h2 class=\"popup-title\" id=\"popup-title\">${escapeHtml(e.title)}</h2>\n              ${e.preservedTitle && e.preservedTitle !== e.title\n                ? `<div class=\"popup-preserved\">${escapeHtml(e.preservedTitle)}</div>` : ''}\n              <div class=\"popup-meta\">${meta}</div>\n              ${summary}\n            </div>\n          </div>\n          ${trackHtml ? `<h3>Tracklist</h3><ol class=\"popup-tracklist\">${trackHtml}</ol>` : ''}\n          ${bodyHtml ? `<h3>Notes</h3>${bodyHtml}` : ''}\n          ${archive ? `<h3>In the archive</h3>${archive}` : ''}\n        `;\n        document.getElementById('popup-close').addEventListener('click', close);\n      }\n\n      function escapeHtml(s) {\n        return String(s).replace(/[&<>\"']/g, c => ({\n          '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;'\n        }[c]));\n      }\n      function simpleMarkdown(md) {\n        // very light \u2014 just paragraphs + headings, enough for the PoC\n        return md.split(/\\n\\n+/).map(block => {\n          if (block.startsWith('## ')) return `<h4>${escapeHtml(block.slice(3))}</h4>`;\n          return `<p>${escapeHtml(block.replace(/\\n/g, ' ').trim())}</p>`;\n        }).join('');\n      }\n\n      function open(id) {\n        const e = DATA[id];\n        if (!e) return;\n        renderPopup(e);\n        scrim.setAttribute('open', '');\n        document.body.style.overflow = 'hidden';\n      }\n      function close() {\n        scrim.removeAttribute('open');\n        document.body.style.overflow = '';\n      }\n      scrim.addEventListener('click', ev => {\n        if (ev.target === scrim) close();\n      });\n      document.addEventListener('keydown', ev => {\n        if (ev.key === 'Escape' && scrim.hasAttribute('open')) close();\n      });\n      document.querySelectorAll('.entry').forEach(el => {\n        el.addEventListener('click', () => open(el.dataset.entryId));\n      });\n\n      // Filter tabs \u2014 two independent axes (project + kind). AND semantics.\n      const state = { project: 'all', kind: 'all' };\n      function applyFilters() {\n        document.querySelectorAll('.entry').forEach(el => {\n          const okProj = state.project === 'all' || el.dataset.project === state.project;\n          const okKind = state.kind === 'all' || el.dataset.kind === state.kind;\n          el.hidden = !(okProj && okKind);\n        });\n        // Hide empty year rows\n        document.querySelectorAll('.year-row').forEach(row => {\n          const visible = row.querySelectorAll('.entry:not([hidden])').length;\n          row.style.display = visible ? '' : 'none';\n        });\n      }\n      document.querySelectorAll('.filter-btn').forEach(btn => {\n        btn.addEventListener('click', () => {\n          const axis = btn.dataset.axis;\n          const value = btn.dataset.value;\n          state[axis] = value;\n          document.querySelectorAll(`.filter-btn[data-axis=\"${axis}\"]`)\n            .forEach(b => b.classList.toggle('active', b.dataset.value === value));\n          applyFilters();\n        });\n      });\n    })();\n  <\/script> "], [" ", '<header class="masthead"> <h1>COLIN <span class="dim">/</span> WARD <span class="dim">/</span> CRFW</h1> <div class="sub"> ', " entries \xB7 ", " releases \xB7 ", ' \xB7 archive in motion\n</div> </header> <nav class="filters" id="filters"> <span class="filters-label">Project</span> <button class="filter-btn active" data-axis="project" data-value="all">All</button> ', ' <span class="group-sep"></span> <span class="filters-label">Medium</span> <button class="filter-btn active" data-axis="kind" data-value="all">All</button> ', ' </nav> <main class="timeline"> ', ' </main> <footer class="foot">\nCRFW timeline \xB7 proof of concept \xB7 ', ' entries indexed\n</footer>  <div class="popup-scrim" id="popup-scrim" role="dialog" aria-modal="true" aria-labelledby="popup-title"> <div class="popup" id="popup"></div> </div>  <script id="entry-data" type="application/json">', "<\/script> <script>\n    (function () {\n      const raw = document.getElementById('entry-data').textContent;\n      const DATA = JSON.parse(raw);\n      const scrim = document.getElementById('popup-scrim');\n      const popup = document.getElementById('popup');\n\n      function renderPopup(e) {\n        const d = e.data || {};\n        const cover = e.cover || d.coverArt;\n        const trackHtml = (d.tracklist || []).map(t => \\`\n          <li>\n            <span class=\"n\">\\${t.n ?? ''}</span>\n            <span>\n              <span class=\"track-title\">\\${escapeHtml(t.title)}</span>\n              \\${t.preservedTitle && t.preservedTitle !== t.title\n                ? \\`<span class=\"track-preserved\">\\${escapeHtml(t.preservedTitle)}</span>\\`\n                : ''}\n            </span>\n          </li>\\`).join('');\n        const summary = d.summary ? \\`<div class=\"summary\"><p>\\${escapeHtml(d.summary)}</p></div>\\` : '';\n        const bodyHtml = d.body ? \\`<div class=\"summary\">\\${simpleMarkdown(d.body)}</div>\\` : '';\n        const archive = d.archivePath\n          ? \\`<div class=\"archive-path\">\u{1F4C1} \\${escapeHtml(d.archivePath)}</div>\\` : '';\n        const meta = [\n          d.date || e.date,\n          e.project,\n          d.format,\n          d.era,\n          e.kind,\n        ].filter(Boolean).map(m => \\`<span>\\${escapeHtml(m)}</span>\\`).join('');\n\n        popup.innerHTML = \\`\n          <button class=\"popup-close\" aria-label=\"Close\" id=\"popup-close\">\xD7</button>\n          <div class=\"popup-header\">\n            \\${cover ? \\`<img class=\"popup-cover\" src=\"\\${cover}\" alt=\"\" />\\` : '<div class=\"popup-cover\"></div>'}\n            <div>\n              <h2 class=\"popup-title\" id=\"popup-title\">\\${escapeHtml(e.title)}</h2>\n              \\${e.preservedTitle && e.preservedTitle !== e.title\n                ? \\`<div class=\"popup-preserved\">\\${escapeHtml(e.preservedTitle)}</div>\\` : ''}\n              <div class=\"popup-meta\">\\${meta}</div>\n              \\${summary}\n            </div>\n          </div>\n          \\${trackHtml ? \\`<h3>Tracklist</h3><ol class=\"popup-tracklist\">\\${trackHtml}</ol>\\` : ''}\n          \\${bodyHtml ? \\`<h3>Notes</h3>\\${bodyHtml}\\` : ''}\n          \\${archive ? \\`<h3>In the archive</h3>\\${archive}\\` : ''}\n        \\`;\n        document.getElementById('popup-close').addEventListener('click', close);\n      }\n\n      function escapeHtml(s) {\n        return String(s).replace(/[&<>\"']/g, c => ({\n          '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;'\n        }[c]));\n      }\n      function simpleMarkdown(md) {\n        // very light \u2014 just paragraphs + headings, enough for the PoC\n        return md.split(/\\\\n\\\\n+/).map(block => {\n          if (block.startsWith('## ')) return \\`<h4>\\${escapeHtml(block.slice(3))}</h4>\\`;\n          return \\`<p>\\${escapeHtml(block.replace(/\\\\n/g, ' ').trim())}</p>\\`;\n        }).join('');\n      }\n\n      function open(id) {\n        const e = DATA[id];\n        if (!e) return;\n        renderPopup(e);\n        scrim.setAttribute('open', '');\n        document.body.style.overflow = 'hidden';\n      }\n      function close() {\n        scrim.removeAttribute('open');\n        document.body.style.overflow = '';\n      }\n      scrim.addEventListener('click', ev => {\n        if (ev.target === scrim) close();\n      });\n      document.addEventListener('keydown', ev => {\n        if (ev.key === 'Escape' && scrim.hasAttribute('open')) close();\n      });\n      document.querySelectorAll('.entry').forEach(el => {\n        el.addEventListener('click', () => open(el.dataset.entryId));\n      });\n\n      // Filter tabs \u2014 two independent axes (project + kind). AND semantics.\n      const state = { project: 'all', kind: 'all' };\n      function applyFilters() {\n        document.querySelectorAll('.entry').forEach(el => {\n          const okProj = state.project === 'all' || el.dataset.project === state.project;\n          const okKind = state.kind === 'all' || el.dataset.kind === state.kind;\n          el.hidden = !(okProj && okKind);\n        });\n        // Hide empty year rows\n        document.querySelectorAll('.year-row').forEach(row => {\n          const visible = row.querySelectorAll('.entry:not([hidden])').length;\n          row.style.display = visible ? '' : 'none';\n        });\n      }\n      document.querySelectorAll('.filter-btn').forEach(btn => {\n        btn.addEventListener('click', () => {\n          const axis = btn.dataset.axis;\n          const value = btn.dataset.value;\n          state[axis] = value;\n          document.querySelectorAll(\\`.filter-btn[data-axis=\"\\${axis}\"]\\`)\n            .forEach(b => b.classList.toggle('active', b.dataset.value === value));\n          applyFilters();\n        });\n      });\n    })();\n  <\/script> "])), maybeRenderHead(), totals.total, totals.releases, years.length > 0 ? `${years[years.length - 1]}\u2013${years[0]}` : "", projects.map((p) => renderTemplate`<button class="filter-btn" data-axis="project"${addAttribute(p, "data-value")}>${p}</button>`), kinds.map((k) => renderTemplate`<button class="filter-btn" data-axis="kind"${addAttribute(k, "data-value")}>${k.replace("_", " ")}</button>`), years.map((year) => renderTemplate`<section class="year-row"${addAttribute(year, "data-year")}> <div class="year-label"> ${year} <span class="after">${byYear.get(year).length} entries</span> </div> <div class="entries"> ${byYear.get(year).map((e) => renderTemplate`<article${addAttribute(`entry size-${e.size}`, "class")}${addAttribute(e.project, "data-project")}${addAttribute(e.kind, "data-kind")}${addAttribute(e.id, "data-entry-id")}> ${e.project && renderTemplate`<span class="project-tag">${e.project}</span>`} ${e.cover && renderTemplate`<img class="cover"${addAttribute(e.cover, "src")} alt="" loading="lazy">`} <div> <div class="title">${e.title}</div> ${e.preservedTitle && e.preservedTitle !== e.title && renderTemplate`<div class="preserved">${e.preservedTitle}</div>`} </div> <div class="medium-tag">${e.kind.replace("_", " ")} · ${e.date}</div> </article>`)} </div> </section>`), totals.total, unescapeHTML(JSON.stringify(Object.fromEntries(entries.map((e) => [e.id, e]))))) })}`;
}, "/sessions/amazing-keen-gates/mnt/outputs/crfw-site/src/pages/index.astro", void 0);

const $$file = "/sessions/amazing-keen-gates/mnt/outputs/crfw-site/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
