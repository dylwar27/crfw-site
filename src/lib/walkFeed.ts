/**
 * walkFeed.ts — flatten published entries into the manifest the motif walk
 * landing page (`/`) consumes. Mirrors the entry id shape used by index.astro
 * (`release--<slug>`, `video--<slug>.json`, `voice--<slug>.json`,
 * `photo--<slug>.json`, `event--<slug>`) so popups continue to work via the
 * shared `<PopupShell />`.
 */

export type WalkKind = 'release' | 'video' | 'voice_memo' | 'photo' | 'event';

export interface WalkEntry {
  id: string;
  kind: WalkKind;
  title: string;
  preservedTitle?: string;
  date: string;
  year: number;
  project?: string;
  cover?: string;
  tags: string[];
  motifs: string[];
  series: string[];
  /** True when the underlying entry has youtubeId (drives inline-play UX). */
  ytId?: string;
  /** True when the underlying entry has bandcampItemId (drives inline-play UX). */
  bandcampItemId?: string;
  bandcampItemType?: string;
}

/**
 * Build the entryId → motifSlug[] reverse index from the vault_motifs
 * collection. Motif `members[]` reference vault slugs like
 * `releases/<slug>` or `tracks/<slug>`. We map those to the site entry id
 * shape used everywhere else (`release--<slug>`).
 *
 * Motifs whose members reference `tracks/<slug>` are resolved up to the
 * parent release if `tracks` collection contains a `release` link;
 * otherwise that membership edge is dropped (the walk has nothing to point
 * to).
 */
export function buildMotifIndex(
  motifs: Array<{ id: string; data: any }>,
  tracks: Array<{ id: string; data: any }> = [],
): Map<string, string[]> {
  const trackToRelease = new Map<string, string>();
  for (const t of tracks) {
    const trackSlug = t.id.replace(/\.json$/, '');
    const releaseRef = t.data?.release;
    if (typeof releaseRef === 'string') {
      // releaseRef looks like "releases/<slug>"
      const [, ...rest] = releaseRef.split('/');
      const releaseSlug = rest.join('/');
      if (releaseSlug) trackToRelease.set(trackSlug, releaseSlug);
    }
  }

  const out = new Map<string, string[]>();
  function attach(entryId: string, motifSlug: string) {
    if (!out.has(entryId)) out.set(entryId, []);
    const existing = out.get(entryId)!;
    if (!existing.includes(motifSlug)) existing.push(motifSlug);
  }

  for (const motif of motifs) {
    if (motif.data?.public_display === false) continue;
    if (motif.data?.kind && motif.data.kind !== 'motif') continue;
    const motifSlug = motif.id.replace(/\.json$/, '');
    const members: string[] = motif.data?.members ?? [];
    for (const ref of members) {
      const [coll, ...rest] = ref.split('/');
      const memberSlug = rest.join('/');
      if (!coll || !memberSlug) continue;
      if (coll === 'releases') {
        attach(`release--${memberSlug}`, motifSlug);
      } else if (coll === 'tracks') {
        const releaseSlug = trackToRelease.get(memberSlug);
        if (releaseSlug) attach(`release--${releaseSlug}`, motifSlug);
      } else if (coll === 'videos') {
        // Videos are stored as <slug>.json on the site
        attach(`video--${memberSlug}.json`, motifSlug);
      } else if (coll === 'voice_memos') {
        attach(`voice--${memberSlug}.json`, motifSlug);
      } else if (coll === 'photos') {
        attach(`photo--${memberSlug}.json`, motifSlug);
      }
    }
  }

  return out;
}

/**
 * Build the series reverse index — same shape as motifs but driven by
 * `vault_series.members`. Sibling of `seriesByEntry` already inline in
 * timeline.astro/index.astro; lifted here so the walk page reuses one
 * implementation.
 */
export function buildSeriesIndex(
  series: Array<{ id: string; data: any }>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  function attach(entryId: string, slug: string) {
    if (!out.has(entryId)) out.set(entryId, []);
    const existing = out.get(entryId)!;
    if (!existing.includes(slug)) existing.push(slug);
  }
  for (const s of series) {
    const slug = s.id.replace(/\.json$/, '');
    const members: string[] = s.data?.members ?? [];
    for (const ref of members) {
      const [coll, ...rest] = ref.split('/');
      const memberSlug = rest.join('/');
      if (!coll || !memberSlug) continue;
      if (coll === 'releases') attach(`release--${memberSlug}`, slug);
      else if (coll === 'videos') attach(`video--${memberSlug}.json`, slug);
      else if (coll === 'voice_memos') attach(`voice--${memberSlug}.json`, slug);
      else if (coll === 'photos') attach(`photo--${memberSlug}.json`, slug);
    }
  }
  return out;
}

interface BuildWalkFeedInput {
  releases: Array<{ id: string; data: any; body?: string }>;
  videos: Array<{ id: string; data: any }>;
  voice_memos: Array<{ id: string; data: any }>;
  photos: Array<{ id: string; data: any }>;
  motifsByEntry: Map<string, string[]>;
  seriesByEntry: Map<string, string[]>;
  withBase: (p: unknown) => string | undefined;
}

/**
 * Walk feed: flat list of every published entry across kinds, with the
 * relatedness signals (motifs, series, project, year, tags) preloaded so
 * the client-side walker can score candidates against the current card.
 *
 * The feed contains lightweight metadata only — full popup payloads still
 * live in `#entry-data` (rendered by `<PopupShell />`), so opening a popup
 * works identically to the timeline.
 */
export function buildWalkFeed(input: BuildWalkFeedInput): WalkEntry[] {
  const { releases, videos, voice_memos, photos, motifsByEntry, seriesByEntry, withBase } = input;
  const out: WalkEntry[] = [];

  for (const r of releases) {
    if (r.data?.published === false) continue;
    const slug = r.id.replace(/\.(md|mdx)$/, '');
    const id = `release--${slug}`;
    const date = r.data.date as string;
    const year = parseInt(date.slice(0, 4), 10);
    out.push({
      id,
      kind: 'release',
      title: r.data.title,
      preservedTitle: r.data.preservedTitle,
      date,
      year,
      project: r.data.project,
      cover: withBase(r.data.coverArt),
      tags: r.data.tags ?? [],
      motifs: motifsByEntry.get(id) ?? [],
      series: seriesByEntry.get(id) ?? [],
      bandcampItemId: r.data.bandcampItemId,
      bandcampItemType: r.data.bandcampItemType,
    });
  }

  for (const v of videos) {
    if (v.data?.published === false) continue;
    const date = (v.data?.date ?? '0000-00-00') as string;
    const year = parseInt(date.slice(0, 4), 10);
    if (!year) continue;
    const id = `video--${v.id}`;
    const ytThumb = v.data.youtubeId
      ? `https://img.youtube.com/vi/${v.data.youtubeId}/hqdefault.jpg`
      : undefined;
    out.push({
      id,
      kind: 'video',
      title: v.data.title,
      date,
      year,
      project: v.data.project,
      cover: withBase(v.data.poster) || ytThumb,
      tags: v.data.tags ?? [],
      motifs: motifsByEntry.get(id) ?? [],
      series: seriesByEntry.get(id) ?? [],
      ytId: v.data.youtubeId,
    });
  }

  for (const m of voice_memos) {
    if (m.data?.published === false) continue;
    const date = m.data.date as string;
    const year = parseInt(date.slice(0, 4), 10);
    if (!year) continue;
    const id = `voice--${m.id}`;
    out.push({
      id,
      kind: 'voice_memo',
      title: m.data.title ?? 'Voice memo',
      date,
      year,
      project: m.data.project,
      tags: m.data.tags ?? [],
      motifs: motifsByEntry.get(id) ?? [],
      series: seriesByEntry.get(id) ?? [],
    });
  }

  for (const p of photos) {
    if (p.data?.published === false) continue;
    const date = (p.data?.date ?? '0000-00-00') as string;
    const year = parseInt(date.slice(0, 4), 10);
    if (!year) continue;
    const id = `photo--${p.id}`;
    out.push({
      id,
      kind: 'photo',
      title: p.data.title ?? 'Untitled photo',
      date,
      year,
      project: p.data.project,
      cover: withBase(p.data.src),
      tags: p.data.tags ?? [],
      motifs: motifsByEntry.get(id) ?? [],
      series: seriesByEntry.get(id) ?? [],
    });
  }

  return out;
}

/**
 * Score a candidate WalkEntry's relatedness to the current entry. Higher
 * score = more related. Used by the walk page's client-side step picker.
 *
 *   shares motif    +10
 *   shares series   +5
 *   shares project  +3
 *   same decade     +1
 *   same kind       +0.5
 */
export function scoreRelatedness(current: WalkEntry, candidate: WalkEntry): number {
  if (current.id === candidate.id) return -1;
  let s = 0;
  if (current.motifs.length && candidate.motifs.length) {
    if (current.motifs.some(m => candidate.motifs.includes(m))) s += 10;
  }
  if (current.series.length && candidate.series.length) {
    if (current.series.some(x => candidate.series.includes(x))) s += 5;
  }
  if (current.project && candidate.project && current.project === candidate.project) s += 3;
  if (current.year && candidate.year && Math.floor(current.year / 10) === Math.floor(candidate.year / 10)) s += 1;
  if (current.kind === candidate.kind) s += 0.5;
  return s;
}
