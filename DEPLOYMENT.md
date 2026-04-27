# DEPLOYMENT.md — how the site ships

The CRFW site builds on every push to `main` via GitHub Actions and deploys to **Cloudflare Pages** at:

- **Production:** https://crfw-site.pages.dev/
- **Branch previews:** `https://<branch-name>.crfw-site.pages.dev/` (created automatically when you push a non-`main` branch)
- **Per-deploy hashes:** `https://<commit-hash>.crfw-site.pages.dev/` (every deploy gets a unique URL — useful for sharing a snapshot)

History note: hosted on GitHub Pages at `/crfw-site/` until 2026-04-26. Migration was forced by GH Pages's 1 GB site limit (we hit it after the voice-memo audio import) and the desire for per-branch preview URLs to share drafts with family before merging.

---

## How a deploy happens

1. You push to `main` (or open a PR to `main`)
2. `.github/workflows/deploy.yml` fires
3. GH Actions runs `npm ci` + `npm run build` (vault sync + reconcile + astro build + pagefind + db-sync)
4. `npx wrangler pages deploy dist --project-name crfw-site --branch <branch>` uploads to Cloudflare
5. Cloudflare assigns a deploy URL and (for PRs) wrangler comments the preview URL on the PR

Total time: ~3-5 minutes typical.

---

## Required secrets

GH Actions needs two repo-level secrets to authenticate with Cloudflare:

| Secret | Value | Where it comes from |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | scoped API token | https://dash.cloudflare.com/profile/api-tokens — "Create Token" → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | `7012c01c1ca2556c80f9b1a1d0dfba4c` | Visible at the top of the Cloudflare dashboard sidebar |

To rotate or update either:

```bash
echo "<new-value>" | gh secret set CLOUDFLARE_API_TOKEN -R dylwar27/crfw-site
echo "<value>"     | gh secret set CLOUDFLARE_ACCOUNT_ID -R dylwar27/crfw-site
```

---

## Manual deploy (when you want to push without going through GH Actions)

```bash
cd ~/crfw-site
npm run build
npx wrangler pages deploy dist --project-name crfw-site --branch main --commit-dirty=true
```

You need to be `wrangler login`-ed (one-time OAuth flow). Verify with `npx wrangler whoami`.

This is the same flow GH Actions uses. Useful for:
- Testing a deploy without committing
- Hot-fixing a deploy when CI is broken
- Pushing from a machine without GitHub access

---

## Per-file size limit

Cloudflare Pages caps individual files at **25 MB**. We re-encoded 4 oversized voice-memo `.m4a` files to mono / 48 kbps to fit:
- `20151009-234944.m4a` (was 24 MB → 19 MB)
- `20160209-195336.m4a` (was 27 MB → 5 MB)
- `20160228-132720.m4a` (was 48 MB → 11 MB)
- `20160228-144442.m4a` (was 33 MB → 8 MB)

If a future ingest produces a file over 25 MB, the deploy fails with a clear error. Re-encode with:

```bash
ffmpeg -i input.m4a -c:a aac -b:a 48k -ac 1 output.m4a
```

---

## Rolling back a deploy

Cloudflare keeps every deployment. To roll back:

1. Go to https://dash.cloudflare.com/?to=/:account/workers-and-pages
2. Click on `crfw-site` project
3. Find the previous good deployment in the list
4. Click "..." → "Rollback to this deployment"

This makes that deployment the current production. New pushes still trigger fresh deploys; this is a temporary override.

Or with wrangler:

```bash
npx wrangler pages deployment list --project-name crfw-site
# pick a deployment ID, then:
npx wrangler pages deployment activate <deployment-id> --project-name crfw-site
```

---

## Switching to a custom domain

(When you've purchased one.)

1. Cloudflare dashboard → `crfw-site` project → "Custom domains" → "Set up a custom domain" → enter your domain
2. Cloudflare gives you a CNAME record to add at your domain registrar
3. Add the CNAME, wait a few minutes for propagation
4. In `astro.config.mjs`, swap `site: 'https://crfw-site.pages.dev'` for `site: 'https://<your-domain>'`
5. Commit, push, redeploy
6. Optionally redirect the GH Pages URL with a `<meta http-equiv="refresh">` page so old links still work

The `base: '/'` stays the same. No other code changes needed.

---

## What lives where

| Concern | Location |
|---|---|
| Build config | `astro.config.mjs` |
| Deploy workflow | `.github/workflows/deploy.yml` |
| Wrangler binary | `node_modules/.bin/wrangler` (devDep) |
| Wrangler login state | `~/.wrangler/` (machine-local OAuth token) |
| Cloudflare project config | dashboard only — not in repo |
| GH Actions secrets | dashboard at https://github.com/dylwar27/crfw-site/settings/secrets/actions |

---

## Old GitHub Pages URL

The repo's GH Pages site at https://dylwar27.github.io/crfw-site/ is no longer maintained as of 2026-04-26. The `gh-pages` branch (if it exists) may still be live but stale. To formally take it down:

```bash
gh api -X DELETE /repos/dylwar27/crfw-site/pages
```

Or via the dashboard at `Settings → Pages → Delete site`.

Until that runs, GH Pages just keeps serving the last deploy. It's harmless — just a stale cache pointing at the pre-Cloudflare site.

---

## See also

- `SCRIPT_PIPELINE.md` — what each build script does
- `SESSION_WORKFLOW.md` — push hang policy and start/end checklists
- `CLAUDE.md` — agent briefing
- `SESSIONS.md` — running history including the Cloudflare migration entry
