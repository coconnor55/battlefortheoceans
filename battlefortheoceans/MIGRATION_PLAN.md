# Battle for the Oceans — Netlify → Spinney migration plan

**Status:** Phase 0 decided. **P1–P2 complete** (`http://spinney.local:3002`, app `2.2.6`). **P3.1 complete** (Supabase Auth URLs → Spinney). Next: P3.2–P3.3, then smoke §6.
**Written:** 2026-09-29, revised 2026-09-30 (Opus, high). Steps are for cheaper models unless tagged otherwise.
**App folder:** `battlefortheoceans/battlefortheoceans/` (git root is one level up).
**Supabase:** project `xrsfrllrmquucrftnymy` — already in use; not migrated, not replaced.
**Target:** `http://spinney.local:3002` (household LAN only). `battlefortheoceans.com` → retired page on Vercel `ocw`. Netlify, Stripe, and Brevo shut down.

---

## 1. Verdict

The move is safe for the game engine, because hosting never touches it.

Evidence (checked 2026-09-29):

- The app is a Create React App **static SPA**. `npm run build` passes unchanged on Node 22.10 in ~13 s (`build/`, 381 kB gzip JS). Any static file server can host it.
- `src/classes`, `src/engines`, `src/handlers`, `src/renderers` import no React. `CoreEngine.dispatch()` is synchronous. The only async in the engine is animation delays and fire-and-forget Supabase writes, all in the browser.
- The engine talks to Supabase directly from the browser (`src/utils/supabaseClient.js`). That does not change with the host.
- Netlify owns only: static hosting + SPA rewrite (`public/_redirects`, `netlify.toml` headers), and five serverless functions in `netlify/functions/` (Stripe ×3, Brevo ×2).

## 2. Rules every step follows

Read before the first edit of any step:

1. `/Users/clintoconnor/Documents/GitHub/misc/agent-instructions/skills/universal-coding/SKILL.md`
2. `docs/Game_Bible_v4_2.md` → **Development Standards** (repo rules; win on project facts)
3. This plan's locked decisions (§3) and Phase 0 answers (§4)

Landing a step (commit / push) follows `/Users/clintoconnor/Documents/GitHub/misc/agent-instructions/skills/universal-git/SKILL.md` and waits for the user's `gitpush`. Steps in other repos (`ocw`, `spinney-hub`) follow that repo's own rules and version owner.

**Versioning (D3):** in the same edit as any change that ships in the app:

- Bump `"version"` in `public/config/game-config.json` (patch; currently `2.2.2`; after `x.y.99` → `x.(y+1).0`). This is the version the Launch page shows.
- In every `src/` file touched, bump its `const version` and add the header change line, per the Game Bible.
- New JS files start at `v0.1.0` with the Game Bible header. Shell scripts, plist, JSON, and Markdown carry no per-file version.
- Do not touch `package.json` `version`.
- Docs-only and deploy-script-only changes do not bump the app version.

**Engine firewall.** No step may edit `src/classes/**`, `src/engines/**`, `src/handlers/**`, `src/renderers/**`, `src/context/**`, `src/hooks/**`, or `public/config/**` — except the `"version"` line in `game-config.json` and any exception a step names explicitly. **Named exceptions (2026-09-30):** `src/classes/Ship.js` may import `uniqueId()` (LAN HTTP); `src/hooks/useEraBadges.js` must use `RightsService` for guest badges so D8 open-access applies. Check at the end of every step:

```bash
git diff -- battlefortheoceans/src/classes battlefortheoceans/src/engines battlefortheoceans/src/handlers battlefortheoceans/src/renderers battlefortheoceans/src/context battlefortheoceans/src/hooks battlefortheoceans/public/config
```

The only allowed hunks are the ones the step names. Anything else: revert it, **Escalate:**, and stop.

**Cheap check:** `npm run build` in the app folder must pass. Say that you ran it.

## 3. Locked decisions (settled by evidence — do not reopen)

| Decision | Choice | Why |
|---|---|---|
| Framework | Stay on Create React App. No Next.js, no Vite, no SSR. | SMR went greenfield Next.js; BFTO must not. A port is the only thing here that could endanger the engine. CRA builds fine on Node 22. |
| Database / auth | Existing Supabase project, unchanged. | Already the backend. |
| Spinney port | `3002` | Budget `:3000`, SpeedMyReading `:3001` (spinney-hub `index.html`). |
| Spinney pattern | Mirror SpeedMyReading: rsync source → `npm ci` + `npm run build` on Spinney → LaunchAgent `com.household.battlefortheoceans` → logs in `~/Library/Logs/battlefortheoceans/`. Remote dir `~/BattleForTheOceans`. | One household pattern. |
| Static server | `serve`, exact version pinned in `dependencies`, run as `serve -s build -l 3002`. `-s` replaces `public/_redirects`. | Smallest Node static server with SPA fallback; LaunchAgent pattern expects a Node process. |
| Auth redirect code | No code change. `LoginDialog.js` uses `window.location.origin` when the host is not `battlefortheoceans.com`, so Spinney sends `http://spinney.local:3002`. | Only Supabase Auth settings change. |
| Feature switch names | `REACT_APP_PURCHASE_ENABLED`, `REACT_APP_INVITE_ENABLED` in `.env`. | Create React App compiles only `REACT_APP_*` variables into the bundle; a bare `PURCHASE_ENABLED` would always read as undefined. |
| `isProduction` in `App.js`, `PurchasePage.js`, `PromotionalBox.js` | Leave. Declared and unused. | Out of scope; dead code noted. |

## 4. Phase 0 — decisions (all decided 2026-09-30)

| # | Question | Answer |
|---|---|---|
| D1 | Public or LAN-only? | **LAN-only**, like SpeedMyReading. `battlefortheoceans.com` + `www` rewrite to a Retired page on Vercel `ocw`; `ocw`'s menu lists Battle for the Oceans. |
| D2 | Five Netlify functions? | **Removed with Netlify.** No new function host. Stripe and Brevo accounts shut down afterward (Phase 7). |
| D2b | Stripe live or sandbox? | **Unknown** — checked by the human in P7.2 step 1 before anything is deleted. |
| D3 | Version owner | **Both:** app-wide = `game-config.json` `"version"` (shown on the Launch page), plus Game Bible per-file versions. Rules in §2. |
| D4 | Repo rules not in git | **Track the Game Bible.** `.gitignore` now ignores `docs/*` except `docs/Game_Bible_v4_2.md` (scanned: no secrets). Done; lands with the next `gitpush`. |
| D5 | Missing `create_checkout_session` | Moot — purchases are switched off. |
| D6 | Invite endpoints are an open relay | Moot — invites are switched off and the functions are deleted. |
| D7 | Off switch | **Two independent `.env` switches**, both `false`: `REACT_APP_PURCHASE_ENABLED` (Stripe) and `REACT_APP_INVITE_ENABLED` (Brevo). One owner module reads them. The existing `"purchase": false` in `game-config.json` is removed so there is one owner per fact. Unset counts as off. |
| D8 | Paid eras when purchases off | When `PURCHASE_ENABLED` is false, **everyone** (guests and signed-in) can play every era. `RightsService.checkRights` short-circuits to `{ canPlay: true, method: 'free' }`; `consumeRights` consumes nothing. Pass/voucher/purchase gates are skipped. |

**Retired-page inputs (decided 2026-09-30):**

- **O1** — image: `public/assets/images/battlefortheoceans.jpg` (832×1248, 2:3), shown at **3:4 portrait**. Crop centered to 832×1109 (drops 70 px of empty rays at the top and 69 px of floor grid at the bottom; title and bow stay whole).
- **O2** — subtitle: "battlefortheoceans.com is available".
- **O3** — both Retired pages (Battle for the Oceans and SpeedMyReading) must fit one screen with no scrolling on phone, tablet, and laptop. SpeedMyReading keeps its 4:3 landscape image. Today its image is `66.6667vw` wide with no height limit, so on a 1440×900 laptop the image alone is 720 px tall and the page scrolls.

---

## 5. Phases

Order: 1 switches → 2 Spinney host → 3 auth and hub → smoke (§6) → 4 Supabase SMTP gate → 5 `ocw` retired page → 6 DNS → 7 shut down Netlify, Stripe, Brevo → 8 repo cleanup.

### Phase 1 — Feature switches (code)

**P1.1 — Switch owner and call sites.** Model: Auto (Composer). Files in scope:

- **New** `src/constants/Features.js` (Game Bible header, `v0.1.0`):
  `PURCHASE_ENABLED = process.env.REACT_APP_PURCHASE_ENABLED === 'true'`, `INVITE_ENABLED = process.env.REACT_APP_INVITE_ENABLED === 'true'`. Nothing else reads these env vars.
- `.env` (local, gitignored — never commit): add `REACT_APP_PURCHASE_ENABLED=false` and `REACT_APP_INVITE_ENABLED=false`.
- `public/config/game-config.json`: delete the `"purchase": false` line (named firewall exception) and bump `"version"` to `2.2.3`.
- `src/services/RightsService.js` (D8): at the start of `checkRights`, after parameter validation, if `!PURCHASE_ENABLED` return `{ canPlay: true, method: 'free' }` (covers guests and signed-in; `consumeRights` already no-ops for `method: 'free'`). Import from `Features.js`.
- `src/pages/GetAccessPage.js`: both `gameConfig?.purchase !== false` reads (lines ~536 and ~688) → `PURCHASE_ENABLED`. Hide the two invite-a-friend sections (the UI that triggers the `send-invite` handlers at ~301 and ~398, and any control that calls `inviteFriend` from `useInviteFlow`) when `!INVITE_ENABLED`. Voucher entry and pass sections stay.
- `src/components/PromotionalBox.js`: when `!PURCHASE_ENABLED`, return `null` and do not call `stripeService.fetchPrice`.
- `src/pages/OverPage.js`: do not open `PurchasePage` when `!PURCHASE_ENABLED` (guard `handlePurchase` / `showPurchasePage`).
- `src/pages/PurchasePage.js`: import `loadStripe` from `@stripe/stripe-js/pure` (the default entry injects the Stripe.js script as soon as the module loads, and `OverPage` imports this file statically) and create `stripePromise` only when `PURCHASE_ENABLED`.
- `src/components/NavBar.js`: hide the "Invite New Player" admin action when `!INVITE_ENABLED`.
- `src/App.js`: do not render `AdminInvitePage` when `!INVITE_ENABLED`.

Do not touch: `src/hooks/useInviteFlow.js` (its `send-invite` call is unreachable once the GetAccessPage controls are hidden), `StripeService.js`, anything in the firewall except the named `game-config.json` hunks.
Stop: if `inviteFriend` or `StripeService` is called from any file not listed here; if hiding a section needs a CSS change beyond an existing class.
Check: `npm run build`; firewall diff shows only the two `game-config.json` hunks; `rg -n "gameConfig\?\.purchase|REACT_APP_(PURCHASE|INVITE)_ENABLED" src` shows only `Features.js`. Guest can start Midway and Pirates. DevTools → Network after guest play to end + open Get Access: **no** request to `js.stripe.com` and none to `/.netlify/functions/`.

### Phase 2 — Spinney static host

**P2.1 — Household deploy files.** Model: Auto. Files in scope:

- `package.json`: add `serve` (exact version pin) to `dependencies`; add script `"deploy:household": "bash scripts/deploy-household.sh"`.
- `deploy/launchd/com.household.battlefortheoceans.plist`: from SMR's plist; label, `~/BattleForTheOceans`, command `exec npx serve -s build -l 3002`, log dir `battlefortheoceans`.
- `deploy/household.env.example`: same keys as SMR, `HOUSEHOLD_REMOTE_DIR=BattleForTheOceans`.
- `scripts/deploy-household.sh`: SMR's script adapted. Deliberate cross-repo copy (no shared owner exists across repos). Changes: `PORT=3002`, label, log name, remote dir; exclude `build`, `node_modules`, `.git`, `.env`, `deploy/household.env`, `docs`, `netlify`; sync `.env` separately after the main rsync (CRA reads `.env` at build time). Use `npm install` (not `npm ci`) on Spinney — MacBook is arm64, Spinney is x86_64; `ci` fails on optional `@rollup/*` platform packages.
- `scripts/bootstrap-household-server.sh` + `Install Battle for the Oceans.command`: SMR equivalents with the same substitutions.
- `.gitignore`: add `deploy/household.env`.

Do not touch: `netlify.toml`, `public/_redirects`, `netlify/` (Netlify stays live until Phase 7).
Version: none (deploy files only).
Check: `npm run build`; run `npx serve -s build -l 3002` locally, then `curl -s localhost:3002/reset-password | grep -q '<div id="root">'`.
Stop: if `serve` needs config beyond `-s` and `-l`.

**P2.2 — First deploy.** Model: Human (SSH + GUI session on Spinney). `npm run deploy:household`; if the LaunchAgent will not load over SSH, double-click the `.command` on Spinney.
Check: `curl -sf http://spinney.local:3002/` and `/reset-password` return 200 from the MacBook.

### Phase 3 — Auth URLs and hub menu

**P3.1 — Supabase Auth URLs.** Model: Human (dashboard, project `xrsfrllrmquucrftnymy` → Authentication → URL Configuration).

- Site URL: `http://spinney.local:3002`.
- Redirect URLs: add `http://spinney.local:3002/**` and `http://localhost:3000/**`. Remove `https://battlefortheoceans.com/**` and any `*.netlify.app` entries.

**P3.2 — Confirm-signup template.** Model: Auto. In `supabase-email-templates/confirm-signup.html` and `.txt`, replace `https://battlefortheoceans.com` with `http://spinney.local:3002`. Version: none. Human pastes the template into Supabase → Authentication → Email Templates.

**P3.3 — Spinney hub menu.** Model: Auto, in the `spinney-hub` repo only. Add one list item "Battle for the Oceans" with `data-port="3002"` matching the existing two. Human runs `npm run deploy` there.

Then run the smoke matrix (§6) on Spinney. Phases 4–8 wait until it is green.

### Phase 4 — Supabase email gate (before Brevo is touched)

**P4.1** Model: Human. Supabase → Authentication → Emails → SMTP Settings.

- Custom SMTP **off** (Supabase built-in mail): nothing to do.
- Custom SMTP **on with Brevo** (`smtp-relay.brevo.com`): shutting down Brevo in Phase 7 would break sign-up and password-reset emails. **Stop and decide** with the user: switch Supabase back to built-in mail (low hourly limit; fine for a household) or another SMTP provider. Re-run smoke items 3–4 after the change.

### Phase 5 — `ocw` Retired page and menu (O1–O3)

Repo `ocw` (Next.js, Vercel project `ocw`). Today the retired-site facts are duplicated: `RETIRED_HOSTS` sits in both `src/middleware.ts` and `src/components/SiteMenu.tsx`, and the route `/speedmyreading` is hardcoded in both. Adding a second retired site extends that into one owner.

**P5.1 — One owner for retired sites.** Model: Auto.

- **New** `src/lib/retiredSites.ts`: one list `[{ label, route, hosts }]` — SpeedMyReading (`/speedmyreading`, its three current hosts) and Battle for the Oceans (`/battlefortheoceans`, `battlefortheoceans.com`, `www.battlefortheoceans.com`) — plus small helpers: route for a host, is-retired route, is-retired host.
- `src/middleware.ts`: rewrite a request to the route that matches its host (replaces the single hardcoded path).
- `src/components/SiteMenu.tsx`: build `MENU_ITEMS` from the list (SpeedMyReading first, then Battle for the Oceans); the retired-surface check uses the helpers.
- **New** `src/components/RetiredPage.tsx`: the markup of today's SMR page (title "Retired", image, subtitle, whole page links to `https://oconnorworks.com`) with props for image `src`, `alt`, `width`, `height`, and subtitle. Remove the inline `style` on the image; sizing lives in CSS only.
- `src/app/globals.css` — one-screen layout (O3), shared by both pages:
  - `.retired`: `height: 100dvh` (with `100vh` before it for old browsers) instead of `min-height`, `overflow: hidden`, column flex.
  - Title and subtitle blocks: `flex: 0 0 auto`; shrink the fixed paddings (`padding-top: 4.5rem`, `padding-bottom: 8vh`) so the menu button (top right, 40 px) still clears the title — use `clamp()` / `dvh` units, no per-page rules.
  - Image area: `flex: 1 1 auto; min-height: 0`, centered. `.retired-shot`: `height: 100%; width: auto; max-width: 100%; object-fit: contain`, drop `width: 66.6667vw` and the fixed `aspect-ratio: 4 / 3`. The image's own `width`/`height` give its shape, so one rule serves 4:3 and 3:4.
- `src/app/speedmyreading/page.tsx`: render `RetiredPage` with its current image (4:3), alt, and subtitle.
- **New** `public/battlefortheoceans-retired.jpg`: copy of the O1 image cropped centered to 832×1109 — `cp …/battlefortheoceans/public/assets/images/battlefortheoceans.jpg public/battlefortheoceans-retired.jpg && sips --cropToHeightWidth 1109 832 public/battlefortheoceans-retired.jpg`. Confirm the result is 832×1109 with `sips -g pixelWidth -g pixelHeight`.
- **New** `src/app/battlefortheoceans/page.tsx`: metadata title "Battle for the Oceans — Retired", description "battlefortheoceans.com is available."; `RetiredPage` with `/battlefortheoceans-retired.jpg`, `width={832} height={1109}`, alt "Battle for the Oceans poster", subtitle "battlefortheoceans.com is available".
- `README.md`: list the new route and hosts.
- Bump `ocw`'s version owner (read it first).

Stop: if the layout needs a page-specific CSS rule or an inline style to fit — **Escalate:**.
Check: `npm run build` in `ocw`. Then `npm run dev` and, for both `/speedmyreading` and `/battlefortheoceans`, at viewports **390×844** (phone), **820×1180** and **1180×820** (tablet), **1280×720** and **1440×900** (laptop):
- `document.documentElement.scrollHeight <= window.innerHeight` (no vertical scroll) and no horizontal scroll;
- "Retired", the whole image (not cropped by CSS), and the subtitle are all visible; the menu button does not overlap the title;
- take a screenshot of each and show them to the user.
Also: the menu shows both items; on the retired pages the menu button links to `https://oconnorworks.com`.

**P5.2 — Deploy and add domains.** Model: Human. `gitpush` in `ocw` (Vercel deploys). Vercel → project `ocw` → Settings → Domains: add `battlefortheoceans.com` and `www.battlefortheoceans.com`. Note the DNS values Vercel shows for each.

### Phase 6 — DNS cutover (Network Solutions)

Model: Human. Registrar and DNS: **Network Solutions** (nameservers `ns85/ns86.worldnic.com`). Domain renews **2027-09-02**. Records as read on 2026-09-30:

| Type | Host | Current value | Action in Phase 6 |
|---|---|---|---|
| A | `@` | `75.2.60.5` (Netlify) | Change to the value Vercel shows (normally `76.76.21.21`) |
| CNAME | `www` | `battlefortheoceans.netlify.app` | Change to the value Vercel shows (normally `cname.vercel-dns.com`) |
| CNAME | `cdn` | `battlefortheoceans.b-cdn.net` (bunny.net, abandoned Dec 2025) | **Delete** — a dangling CNAME to a CDN you no longer control can be taken over |
| TXT | `@` | `brevo-code:2d0a44b5…` | Leave until P7.3, then delete |
| CNAME | `brevo1._domainkey` | `b1.battlefortheoceans-com.dkim.brevo.com` | Leave until P7.3, then delete |
| CNAME | `brevo2._domainkey` | `b2.battlefortheoceans-com.dkim.brevo.com` | Leave until P7.3, then delete |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | Leave until P7.3, then replace or delete |

There is no MX record, so no mail is received on the domain.

Check (after propagation, up to 48 h): `dig +short battlefortheoceans.com` returns the Vercel IP; `curl -sI https://battlefortheoceans.com` shows `server: Vercel`; both apex and `www` show the Battle for the Oceans Retired page with a valid certificate; `dig +short cdn.battlefortheoceans.com` returns nothing.

### Phase 7 — Shut down Netlify, Stripe, Brevo

All steps: Model: Human. Run after Phase 6's check passes.

**P7.1 — Netlify.**

1. Netlify → site `battlefortheoceans` → Domain management: remove `battlefortheoceans.com` and `www`.
2. Site configuration → Danger zone → **Delete site** (its env vars, functions, and deploys go with it).
3. GitHub → `coconnor55/battlefortheoceans` → Settings → Webhooks / GitHub Apps: remove Netlify's hook or repo access.
4. Netlify account → Billing: cancel any paid plan if no other site uses it.

**P7.2 — Stripe.**

1. Stripe Dashboard → switch to **Live mode** → Payments. If there are any real charges or customers, **stop** and decide with the user (refund, support, record-keeping) before continuing. This answers D2b.
2. Developers → Webhooks, in **both** test and live mode: delete any endpoint pointing at `battlefortheoceans.com/.netlify/functions/stripe_webhook`.
3. Product catalog: archive the Midway (`price_1SKvxVFKFdXJ01egvawS3rHH`) and Pirates (`price_1SKwHzFKFdXJ01egR8DXhm5C`) prices and their products.
4. Developers → API keys: roll or delete the secret key and any restricted keys used by this game.
5. Close the Stripe account **only if** no other project uses it — confirm first.

**P7.3 — Brevo.** Phase 4 must be done first.

1. Brevo → SMTP & API → API keys: delete the key in `.env` `BREVO_API_KEY`.
2. Templates: delete the invite template (`BREVO_INVITE_TEMPLATE_ID`).
3. Senders, Domains & Dedicated IPs: remove domain `battlefortheoceans.com` and sender `battlefortheoceans@gmail.com`.
4. Network Solutions DNS: delete TXT `@` `brevo-code:…`, CNAME `brevo1._domainkey`, CNAME `brevo2._domainkey`. For `_dmarc`, either delete it or — **optional, user choice** — since the domain sends no mail, set TXT `@` `v=spf1 -all` and TXT `_dmarc` `v=DMARC1; p=reject` so nobody can spoof it.
5. Close the Brevo account **only if** no other project uses it.

Check: `dig +short TXT battlefortheoceans.com` and `dig +short CNAME brevo1._domainkey.battlefortheoceans.com` no longer show Brevo values.

### Phase 8 — Repo cleanup

**P8.1** Model: Auto. After Phase 7.

- Delete `netlify.toml`, `public/_redirects`, `netlify/`, `NETLIFY_DEPLOYMENT_CHECKLIST.md`, and the local `.netlify/` folder.
- `package.json`: remove `netlify`, `netlify-cli`, `stripe`, `sib-api-v3-sdk` (none imported under `src/`). Keep `@stripe/stripe-js` and `@stripe/react-stripe-js` — the switched-off purchase UI still imports them.
- `.env` (local, never commit): delete `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MIDWAY`, `STRIPE_PRICE_PIRATES`, `REACT_APP_STRIPE_PUBLISHABLE_KEY`, `BREVO_API_KEY`, `BREVO_INVITE_TEMPLATE_ID`. Keep the two switches set to `false`. Re-run `npm run deploy:household` so Spinney gets the same `.env`.
- Rewrite `DEPLOYMENT.md` for Spinney (deploy command, port, logs, `.env` switches, retired public domain). Update the README deploy lines.
- Bump `game-config.json` `"version"`.

Check: `npm run build`; `rg -n "netlify" src` shows only the `/.netlify/functions/` call sites already behind the switches; redeploy to Spinney and re-run smoke items 1, 2, and 7.

## 6. Smoke matrix (before Phase 4)

On `http://spinney.local:3002`:

1. Home loads; deep link `/reset-password` loads the app (SPA fallback). The Launch page shows `2.2.3` or later.
2. Guest play: Traditional era, place ships, play to game over. Animations and sounds play. The engine firewall diff is empty.
3. Sign up → confirmation email → link lands on Spinney → signed in.
4. Password reset email → `/reset-password` on Spinney.
5. Stats and achievements saved after a finished game (Supabase rows).
6. Guest can play Midway and Pirates without passes or vouchers (`PURCHASE_ENABLED=false`).
7. No request to `js.stripe.com` or `/.netlify/functions/` (DevTools → Network); no purchase or invite controls visible, including the admin "Invite New Player" action.
8. Refresh mid-game restores state (`SessionManager`).

## 7. Not in this plan

- Any change to game logic, AI, era configs, or UI beyond hiding purchase and invite controls.
- Deleting the switched-off Stripe and invite UI code (a later decision; the switches keep it inert).
- Migrating off Create React App.
- Fixing `create_checkout_session` or the unused `isProduction` constants.
- Moving Supabase projects or changing RLS.

## 8. Post-transition tasks

Work after Phases 1–8 are done (not a gate for cutover).

| ID | Note | Source |
|---|---|---|
| PT1 | ~~Popup videos~~ **Resolved 2026-09-30** — working again on Spinney after LAN deploy / uniqueId fix. | Was local CRA observation; closed. |
