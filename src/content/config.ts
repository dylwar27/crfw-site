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
    archivePath: z.string().optional()
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

export const collections = { releases, photos, videos, voice_memos, lyrics, people, events };
