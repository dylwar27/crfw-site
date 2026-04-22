import { defineCollection, z, reference } from 'astro:content';

// Shared vocabulary
//
// Project is a free-form string rather than an enum so new project
// identities (DIMCP, "Dog is my copilot", etc.) can be added without
// schema changes. Known values used so far: 'alphabets', 'killd by',
// 'Colin Ward', 'collaboration', 'other', 'life'.
const project = z.string().min(1)
  .describe('Which creative era or identity this belongs to.');

// All collections share a `published` flag. Defaults to true so existing
// entries are visible without edits. Set to false to log an entry in the
// archive without showing it on the public timeline. The /admin page
// shows everything regardless of this flag.
const published = z.boolean().default(true);

// Flexible date: a full YYYY-MM-DD, or YYYY-MM, or YYYY. Events in Colin's
// archive are often only known to a year or month.
const fuzzyDate = z.string().regex(
  /^\d{4}(-\d{2}(-\d{2})?)?$/,
  'Date must be YYYY, YYYY-MM, or YYYY-MM-DD',
);

// ----- Collections -----

const releases = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    preservedTitle: z.string().optional()
      .describe('Colin\'s original typography if different from title'),
    project,
    date: fuzzyDate,
    era: z.string().optional(),
    format: z.enum(['LP', 'EP', 'single', 'mix', 'compilation', 'b-sides', 'demo', 'other']),
    coverArt: z.string().optional(),
    // --- Embed fields (Session 09 — integrated from CRFW_Media_Embeds.xlsx) ---
    // Iframes are generated at render time from IDs, so these structured
    // fields are portable and survive Bandcamp/YouTube UI changes.
    bandcampUrl: z.string().url().optional(),
    bandcampItemId: z.string().optional(), // numeric Bandcamp item id
    bandcampItemType: z.enum(['album', 'track']).optional(),
    youtubeId: z.string().optional(), // 11-char YouTube video id
    soundcloudUrl: z.string().url().optional(),
    // Legacy free-text embed URLs (pre-Session 09). Keep for backwards
    // compatibility; new content uses the structured fields above.
    bandcampEmbed: z.string().url().optional(),
    soundcloudEmbed: z.string().url().optional(),
    vimeoEmbed: z.string().url().optional(),
    tracklist: z.array(z.object({
      n: z.number().optional(),
      title: z.string(),
      preservedTitle: z.string().optional(),
      duration: z.string().optional(),
      audio: z.string().optional(),
    })).optional(),
    collaborators: z.array(reference('people')).optional(),
    relatedPhotos: z.array(reference('photos')).optional(),
    relatedVideos: z.array(reference('videos')).optional(),
    relatedVoiceMemos: z.array(reference('voice_memos')).optional(),
    relatedLyrics: z.array(reference('lyrics')).optional(),
    tags: z.array(z.string()).default([]),
    archivePath: z.union([z.string(), z.array(z.string())]).optional()
      .describe('Where this lives in the Dropbox archive for curator reference'),
    summary: z.string().optional(),
    published,
  }),
});

const photos = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string().optional(),
    date: fuzzyDate.optional(),
    src: z.string(),
    caption: z.string().optional(),
    project: project.optional(),
    people: z.array(reference('people')).default([]),
    tags: z.array(z.string()).default([]),
    source: z.enum(['archive', 'instagram', 'press', 'friend', 'unknown']).default('archive'),
    sourceUrl: z.string().url().optional(),
    carouselExtras: z.array(z.string()).default([]),
    archivePath: z.string().optional(),
    published,
  }),
});

const videos = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    date: fuzzyDate.optional(),
    vimeoEmbed: z.string().url().optional(),
    youtubeEmbed: z.string().url().optional(),
    localSrc: z.string().optional(),
    poster: z.string().optional(),
    duration: z.string().optional(),
    project: project.optional(),
    people: z.array(reference('people')).default([]),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    kind: z.enum(['music video', 'live', 'rehearsal', 'interview', 'home', 'other']).default('other'),
    youtubeId: z.string().optional(),
    transcript: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    carouselExtras: z.array(z.string()).default([]),
    archivePath: z.string().optional(),
    published,
  }),
});

const voice_memos = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string().optional(),
    date: fuzzyDate,
    src: z.string().optional(),
    duration: z.string().optional(),
    transcript: z.string().optional(),
    summary: z.string().optional(),
    project: project.optional(),
    tags: z.array(z.string()).default([]),
    archivePath: z.string().optional(),
    published,
  }),
});

const lyrics = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    project: project.optional(),
    date: fuzzyDate.optional(),
    relatedRelease: reference('releases').optional(),
    relatedTrack: z.string().optional(),
    archivePath: z.string().optional(),
    tags: z.array(z.string()).default([]),
    published,
  }),
});

const people = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),
    relationship: z.string().optional(),
    links: z.array(z.object({
      label: z.string(),
      url: z.string().url(),
    })).default([]),
    note: z.string().optional(),
  }),
});

// Life events: non-release moments on the timeline (shows, moves, milestones)
const events = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: fuzzyDate,
    project: project.optional(),
    kind: z.enum(['life', 'show', 'release', 'milestone', 'residence', 'collaboration', 'press']).default('life'),
    location: z.string().optional(),
    url: z.string().url().optional(), // external link (press articles, tributes)
    source: z.string().optional(),    // e.g. "westword.com"
    people: z.array(reference('people')).default([]),
    relatedPhotos: z.array(reference('photos')).default([]),
    tags: z.array(z.string()).default([]),
    summary: z.string().optional(),
    published,
  }),
});

// Curator-defined groupings of photos/videos into named sets.
// Forward-only membership: the set stores member slugs; individual
// photos/videos store nothing. The CMS computes membership in memory.
const sets = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    date: fuzzyDate.optional(),
    date_end: fuzzyDate.optional(),
    project: z.string().optional(),
    cover: z.string().optional(),          // representative image path
    members: z.array(z.object({
      kind: z.enum(['photo', 'video', 'voice_memo']),
      slug: z.string(),
    })).default([]),
    tags: z.array(z.string()).default([]),
    published: z.boolean().default(false), // draft until explicitly approved
  }),
});

// ================================================================
// VAULT-PROJECTED COLLECTIONS (Session 13)
//
// The vault at ~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Vault/
// is the authoritative source for structural entities (people,
// projects, venues, orgs, tracks, etc.) — an Obsidian-flavored
// parallel model aligned with DATABASE_BRIEF §3.
//
// `scripts/sync-vault.mjs` projects vault entries into these
// read-only collections so the site can render them. Editing
// happens at the vault source (via Obsidian or Curator's Kit
// vault mode); re-running sync refreshes the projection.
//
// Schemas are deliberately permissive: they preserve ALL the vault
// frontmatter fields we've seen without forcing a migration every
// time the vault grows a new field. The curator keeps adding
// conventions upstream; we accept them here.
// ================================================================

// Common to all vault entries (matches _Vault/SCHEMA.md).
// Wikilinks like [[people/colin-ward]] are normalized by the sync
// script to either an unwrapped "people/colin-ward" string or a
// structured { collection, slug } object (see sync-vault.mjs).
const vaultCommon = {
  id: z.string(),
  kind: z.string(),
  title: z.string().optional(),
  preservedTitle: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  sensitivity: z.enum(['public','restricted','private','redacted']).default('public'),
  public_display: z.boolean().default(true),
  confidence: z.enum(['high','medium','low','speculative']).default('high'),
  source_ids: z.array(z.string()).default([]),
  archivePath: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  body: z.string().optional(),   // markdown body (preserved by sync script)
};

const vault_people = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    legal_name: z.string().optional(),
    display_name: z.string().optional(),
    born: z.string().optional(),
    died: z.string().optional(),
    cause_of_death: z.string().optional(),
    hometown: z.string().optional(),
    role_summary: z.string().optional(),
    primary_project: z.string().optional(),
    projects: z.array(z.string()).default([]),
    contact_public: z.record(z.any()).optional(),
    primary_photo: z.string().nullable().optional(),
  }).passthrough(),
});

const vault_projects = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    name: z.string().optional(),
    project_kind: z.string().optional(),
    primary_medium: z.string().optional(),
    formed_year: z.union([z.number(), z.string()]).nullable().optional(),
    dissolved_year: z.union([z.number(), z.string()]).nullable().optional(),
    primary_person: z.string().optional(),
    members: z.array(z.record(z.any())).default([]),
    canonical_urls: z.array(z.string()).default([]),
    cover_asset: z.string().nullable().optional(),
    summary: z.string().optional(),
  }).passthrough(),
});

const vault_venues = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    name: z.string().optional(),
    venue_kind: z.string().optional(),
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    lat: z.number().nullable().optional(),
    lon: z.number().nullable().optional(),
    status: z.string().optional(),
    opened_year: z.union([z.number(), z.string()]).nullable().optional(),
    closed_year: z.union([z.number(), z.string()]).nullable().optional(),
  }).passthrough(),
});

const vault_organizations = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    name: z.string().optional(),
    org_kind: z.string().optional(),
    website: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    status: z.string().optional(),
  }).passthrough(),
});

const vault_tracks = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    release: z.string().optional(),
    position: z.number().optional(),
    duration_seconds: z.number().nullable().optional(),
    audio_path: z.string().nullable().optional(),
    credits: z.array(z.record(z.any())).default([]),
  }).passthrough(),
});

const vault_releases = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    project: z.string().optional(),
    release_kind: z.string().optional(),
    release_date: z.string().optional(),
    release_year: z.union([z.number(), z.string()]).optional(),
    label: z.string().nullable().optional(),
    catalog_number: z.string().nullable().optional(),
    canonical_url: z.string().nullable().optional(),
    cover_path: z.string().nullable().optional(),
    tracks: z.array(z.string()).default([]),
    is_posthumous: z.boolean().optional(),
  }).passthrough(),
});

const vault_events = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    event_kind: z.string().optional(),
    date: z.string().optional(),
    start_datetime: z.string().nullable().optional(),
    end_datetime: z.string().nullable().optional(),
    venue: z.string().nullable().optional(),
    related_projects: z.array(z.string()).default([]),
    participants: z.array(z.string()).default([]),
    description: z.string().optional(),
  }).passthrough(),
});

const vault_press = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    publication: z.string().optional(),
    author: z.string().nullable().optional(),
    published_date: z.string().optional(),
    press_kind: z.string().optional(),
    canonical_url: z.string().nullable().optional(),
    wayback_url: z.string().nullable().optional(),
    wayback_captured_at: z.string().nullable().optional(),
    local_md_path: z.string().nullable().optional(),
    local_pdf_path: z.string().nullable().optional(),
    local_html_path: z.string().nullable().optional(),
    colin_specific: z.boolean().optional(),
    colin_mention_count: z.number().nullable().optional(),
    mentions: z.array(z.string()).default([]),
  }).passthrough(),
});

const vault_funds = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    name: z.string().optional(),
    host_organization: z.string().nullable().optional(),
    founded_year: z.union([z.number(), z.string()]).nullable().optional(),
    dissolved_year: z.union([z.number(), z.string()]).nullable().optional(),
    mission: z.string().optional(),
    workflow: z.string().optional(),
  }).passthrough(),
});

const vault_grants = defineCollection({
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    fund: z.string().optional(),
    grantee: z.string().optional(),
    year: z.union([z.number(), z.string()]).optional(),
    amount: z.union([z.number(), z.string()]).nullable().optional(),
    purpose: z.string().optional(),
    announcement_date: z.string().optional(),
  }).passthrough(),
});

const vault_series = defineCollection({
  // NEW vault kind introduced this session for release/work series
  // (underwaters I-VI, DDR, SUNPOWER). See vault /series/ folder.
  type: 'data',
  schema: z.object({
    ...vaultCommon,
    name: z.string().optional(),
    project: z.string().optional(),
    date_start: z.string().optional(),
    date_end: z.string().nullable().optional(),
    members: z.array(z.string()).default([]),
    summary: z.string().optional(),
  }).passthrough(),
});

export const collections = {
  releases, photos, videos, voice_memos, lyrics, people, events, sets,
  vault_people, vault_projects, vault_venues, vault_organizations,
  vault_tracks, vault_releases, vault_events, vault_press,
  vault_funds, vault_grants, vault_series,
};
