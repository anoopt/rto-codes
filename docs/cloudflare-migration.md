# Migrating rto-codes.in from Vercel to Cloudflare Pages

**Why:** The site is a fully static export (`next.config.ts` → `output: "export"`). On
Vercel's free tier, every request served counts as an "Edge Request" (1M/month cap) —
even static files — which is why usage hit 75%. Cloudflare Pages (free) does not count
requests or bandwidth for static sites, so this class of email disappears permanently.

**Guiding principle:** Vercel stays live as the fallback until the very last step. There
is **zero downtime** if the phases below are followed in order.

---

## Current state (verified)

| Item | Value |
| --- | --- |
| Hosting | Vercel (free Hobby), auto-deploys on push to `main` |
| Domain DNS | BigRock nameservers (`dns1-4.bigrock.in`) |
| Apex `rto-codes.in` | A record `216.198.79.1` → served by Vercel |
| `www.rto-codes.in` | CNAME → `cname.vercel-dns.com` |
| Other DNS (MX/CAA/TXT) | **None** — no email or other services on this domain, so moving nameservers is low-risk |
| Build | `bun install && bun run build` (prebuild regenerates `index.json` + `sitemap.xml`), output `out/` |
| Build-time env vars | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OSM_ENABLED`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` |

> Note: the apex domain **requires Cloudflare nameservers** (a CNAME at the apex only
> works with Cloudflare's CNAME flattening). Subdomains like `www` can use an external
> CNAME, but since `rto-codes.in` is the canonical URL (sitemap, OG tags, footer), we
> move the whole zone to Cloudflare. Free, and Cloudflare imports the existing records
> automatically.

---

## Phase 0 — Repo prep (this branch: `cloudflare-pages`)

Already done on this branch:
- Added `wrangler.toml` (used for direct-upload deploys; git-integrated builds use the
  dashboard settings below).

Copy the env var **values** from Vercel before you create the Pages project:
Vercel → Project → **Settings → Environment Variables**. You need (Production):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://rto-codes.in` |
| `NEXT_PUBLIC_OSM_ENABLED` | `true` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | *(your Cloudinary cloud name — required or images break)* |

> **CLI alternative:** `vercel env pull --environment=production` (after `vercel login`
> + `vercel link` in the repo) downloads all production env values into `.env.local`
> automatically — no manual copying. See the CLI quick-reference below.

---

## Phase 1 — Create the Cloudflare Pages project

1. [cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git**.
2. Authorize the GitHub app if prompted; select the `anoopt/rto-codes` repo.
3. **Project name:** `rto-codes` (your site becomes `rto-codes.pages.dev`).
4. **Production branch:** `main`.
5. Framework preset: **Next.js (Static HTML Export)**, then override:
   - **Build command:** `bun install && bun run build`
   - **Output directory:** `out`
6. Add the three Production env vars from Phase 0.
7. **Save and Deploy.** First build takes a few minutes.
8. Verify at `https://rto-codes.pages.dev`:
   - Homepage + search
   - An RTO detail page, e.g. `/rto/ka-01` (images, map JSON loads)
   - A non-existent URL shows the 404 page
   - `/sitemap.xml` and `/robots.txt` are reachable

> **If the build fails with `bun: command not found`:** fall back to
> `npm install && npm run build` (there is no `package-lock.json`, so Bun is preferred;
> report the issue if this happens).

> **Troubleshooting — OpenNext error:** if the build log shows
> `bunx opennextjs-cloudflare build` followed by
> `Error: ENOENT: no such file or directory, open '.../.next/standalone/.next/server/pages-manifest.json'`,
> the project is using the plain **"Next.js"** (server/OpenNext) preset, which is
> incompatible with `output: "export"`. Fix in Settings → Builds & deployments →
> Build configuration: Framework preset = **Next.js (Static HTML Export)**, Build
> command = `bun install && bun run build`, Output directory = `out`. Then create a
> fresh deployment (Create deployment, or push an empty commit) — settings are
> snapshotted per deployment, so "Retry" on the old one is not enough.

9. **Settings → Builds & deployments → Preview deployments → None** (saves builds;
   every push to `main` is the only thing that builds).

---

## Phase 2 — Test before touching DNS

- Once `main` has the branch merged (see below), push → Pages rebuilds production →
  re-verify `https://rto-codes.pages.dev`.
- Merge this branch into `main` only after Phase 1 verification passes:
  ```bash
  git checkout main && git merge cloudflare-pages && git push origin main
  ```
  (Vercel will also rebuild `main` — harmless, it's still the fallback.)

---

## Phase 3 — Domain cutover (DNS to Cloudflare)

1. Cloudflare dashboard → **Add site** → `rto-codes.in` → **Free** plan.
   Cloudflare scans and imports the existing A + CNAME records automatically.
2. Cloudflare shows **two nameservers** (e.g. `xxx.ns.cloudflare.com`,
   `yyy.ns.cloudflare.com`). Copy them.
3. At **BigRock** (where the domain is registered):
   Domain management → `rto-codes.in` → **Nameservers** → *custom* → enter Cloudflare's
   two nameservers → Save.
   - Do **not** delete any records at BigRock yet — the imported records keep the site
     working during propagation.
4. Wait for the Cloudflare zone to become **Active** (dashboard banner + email; usually
   minutes, can be a few hours). Propagation while the zone is still on BigRock NS does
   not take the site down.
5. **Add the custom domains in Pages:** Workers & Pages → `rto-codes` → **Custom
   domains** → *Add custom domain* → add **both** `rto-codes.in` and `www.rto-codes.in`.
   Because the zone is on Cloudflare, it auto-creates the CNAME records
   (`rto-codes.in → rto-codes.pages.dev` flattened, `www → rto-codes.pages.dev`).
6. In **DNS → Records**, delete the old Vercel entries:
   - Delete apex A record `216.198.79.1`
   - Delete/replace `www` CNAME `cname.vercel-dns.com` (the Pages step in #5 should
     already have created the new one)
7. Wait for both custom domains to show **Active** (SSL is provisioned automatically).
8. Verify from a device/incognito (DNS may be cached):
   - `https://rto-codes.in` and `https://www.rto-codes.in` both load
   - `dig +short rto-codes.in CNAME` shows the Pages target; `dig +short www.rto-codes.in CNAME` → `rto-codes.pages.dev`
   - Valid HTTPS certificate on both

> Optional canonicalization: both apex and www now serve the site. If you want one to
> redirect to the other, add a free **Redirect Rule** in Cloudflare
> (Rules → Redirect Rules). Not required; the sitemap already uses the apex.

---

## Phase 4 — De-link Vercel (only after Phase 3 is verified)

1. Re-verify the site end-to-end on Cloudflare from a real browser/phone.
2. **Vercel → Project (rto-codes) → Settings → Domains** → remove
   `rto-codes.in` and `www.rto-codes.in`.
   *CLI:* `vercel domains remove rto-codes.in --yes && vercel domains remove www.rto-codes.in --yes`
3. **Vercel → Project → Settings → Danger Zone → Delete Project** → type the project
   name → confirm. This stops Vercel builds, the analytics beacon, and — most
   importantly — the usage meter that generated the warning emails.
   *CLI:* `vercel project remove rto-codes --yes`
4. Optional: remove the **Vercel GitHub app** (GitHub → Settings → Applications →
   Vercel → Configure → Uninstall). Inert once the project is deleted, but tidy.
5. Optional cleanup commit (later, on `main`):
   - Remove `@vercel/analytics` from `package.json` and `app/layout.tsx`
   - Remove `vercel.json` (its `ignoreCommand`/deployment rules no longer apply)
   - Update the README deploy links

---

## Phase 5 — Final checklist

- [ ] `https://rto-codes.in` loads: homepage, search, RTO detail with map, 404
- [ ] `/sitemap.xml`, `/robots.txt` reachable
- [ ] HTTPS valid on apex and `www`
- [ ] Cloudflare Pages: production branch `main`, preview deployments **None**
- [ ] Push to `main` triggers a Pages build (and no longer a Vercel one)
- [ ] Vercel project deleted — no more usage emails

## CLI quick-reference (optional)

Both providers ship CLIs — this reduces (but does not eliminate) dashboard clicking:

- **Vercel CLI:** `npm i -g vercel` → `vercel login` (opens a browser)
- **Cloudflare Wrangler:** `npm i -g wrangler` → `wrangler login` (opens a browser)

For headless/scripted use both accept tokens instead of interactive login:
`VERCEL_TOKEN=<token> vercel ...` and `CLOUDFLARE_API_TOKEN=<token> wrangler ...`
(create tokens in each dashboard; revoke them after the migration).

| Step | CLI command | Dashboard alternative |
| --- | --- | --- |
| Pull Vercel env values | `vercel link` then `vercel env pull --environment=production` | Copy from Settings → Env Vars |
| Create Pages project | `wrangler pages project create rto-codes --production-branch main` | Create → Connect to Git |
| Test-deploy without git | `wrangler pages deploy out` | Direct upload |
| Remove domains from Vercel | `vercel domains remove rto-codes.in --yes` (and `www`) | Settings → Domains |
| Delete Vercel project | `vercel project remove rto-codes --yes` | Settings → Danger Zone |

**Still dashboard/registrar-only (no CLI for these):**

| Step | Where |
| --- | --- |
| Connect Git repo + set build command/out dir + build env vars | Pages project dashboard (build env vars are not exposed by `wrangler` — set them in the project settings) |
| Add the zone, copy the 2 nameservers | Cloudflare dashboard (Add site) |
| Change nameservers | **BigRock** registrar panel |
| Add custom domains to the Pages project | Pages project → Custom domains (wrangler v4 has no `pages domain` command) |
| Edit/delete DNS records | Cloudflare DNS dashboard (wrangler v4 removed `wrangler dns` — API only) |
| Preview deployments → None | Pages project settings |

## Rollback (if anything breaks after the DNS cutover)

Vercel still exists until Phase 4, so:

- In Cloudflare DNS (or back at BigRock): set `www` CNAME → `cname.vercel-dns.com` and
  apex A → `216.198.79.1` (the old values), and wait for propagation.

## Build-count note

After migration, every push to `main` = one Pages build (there is no `ignoreCommand`
equivalent). The automation chain (`scheduled-populate-rto` → `post-merge` →
`auto-complete-state`) currently pushes ~2 commits/day while data is being populated,
tapering to ~0 when complete — roughly 60 builds/month worst case, far under the 500
free limit. Preview deployments are off, so PR/branch pushes don't build.
