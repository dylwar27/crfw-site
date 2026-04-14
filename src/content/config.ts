import { defineCollection, z, reference } from 'astro:content';

// Shared vocabulary
const project = z.enum([
  'alphabets',
  'killd by',
  'Colin Ward',
  'collaboration',
  'other',
  'life',
]).describe('Which creative era or identity this belongs to.');

const medium = z.enum([
  'release',
  'track',
  'mix',
  'video',
  'photo',
  'voice_memo',
  'lyrics',
  'note',
  'artwork',
  'screenshot',
  'event',
  'press',
  'live',
  'interview',
]);

// Flexible date: a full YYYY-MM-DD, or YYYY-MM, or YYYY. Events in Colin's
// archive are often only known to a year or month.
const fuzzyDate = z.string().regex(
  /^\d{4}(-\d{2}(-\d{2})?)?$/,
  'Date must be YYYY, YYYY-MM, or YYYY-MM-DD',
);

// A link to a media asset — either a path under /public, or an external URL
// (Vimeo, Bandcamp, SoundCloud, Instagram, etc.)
const mediaRef = z.object({
  kind: z.enum(['audio', 'video', 'image', 'embed', 'link']),
  src: z.string(),            // /media/... or https://...
  title: z.string().optional(),
  note: z.string().optional(),
  duration: z.string().optional(), // "3:42"
});

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
    archivePath: z.string().optional(),
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
    people: z.array(reference('people')).default([]),
    relatedPhotos: z.array(reference('photos')).default([]),
    tags: z.array(z.string()).default([]),
    summary: z.string().optional(),
  }),
});

export const collections = { releases, photos, videos, voice_memos, lyrics, people, events };
