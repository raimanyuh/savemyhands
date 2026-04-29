# savemyhands — deployment walkthrough

This file is a self-contained guide for getting savemyhands deployed publicly. It assumes the **code is finished and committed**; the only remaining work is configuring GitHub, Vercel, and Supabase.

You can hand this whole file to a Claude.ai chat and ask it to walk you through each step interactively.

---

## Stack at a glance

- **App**: Next.js 16 (App Router, Turbopack)
- **Auth + DB**: Supabase (Postgres + Auth, OAuth providers Google/Discord)
- **Hosting**: Vercel
- **Local secrets**: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The Supabase project hosts itself — there's nothing to "deploy" on the Supabase side, only configuration. The Next.js app is what gets deployed to Vercel.

---

## Prerequisites checklist

Before starting, verify you have all of these. Don't skip — most deployment failures trace back to one of these missing.

- [ ] A GitHub account
- [ ] A Vercel account (sign up with the same GitHub account for fastest setup)
- [ ] An existing Supabase project for this app (the one you've been using locally — the `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` points at it)
- [ ] Access to the Supabase dashboard for that project
- [ ] All four database migrations have been applied to that project. Verify by opening Supabase → SQL Editor → New Query → run:
      ```sql
      select tablename from pg_tables where schemaname = 'public' order by tablename;
      ```
      You should see rows for `hands` and `profiles`. Then run:
      ```sql
      select proname from pg_proc where proname = 'delete_my_account';
      ```
      You should get one row. If `profiles` is missing, apply `supabase/migrations/0003_profiles.sql`. If `delete_my_account` is missing, apply `supabase/migrations/0004_delete_my_account.sql`.
- [ ] If you set up Google or Discord OAuth: access to those provider consoles (Google Cloud Console / Discord Developer Portal)

---

## Step 1 — Push the repo to GitHub

If the project is already in a GitHub repo, skip this step.

1. Go to <https://github.com/new>
2. Repo name: `savemyhands` (or anything you like)
3. Visibility: **Private** is fine — Vercel can read private repos when authorized
4. **Do not** initialize with README, .gitignore, or license — your local repo already has those
5. Click **Create repository**

GitHub now shows you push instructions. From your project directory (`C:\Users\Administrator\Desktop\savemyhands`):

```bash
git status                            # confirm there are no uncommitted changes you want first
git remote add origin https://github.com/<your-username>/savemyhands.git
git branch -M main
git push -u origin main
```

After this completes, refresh GitHub — you should see all your files. **Verify `.env.local` is NOT in the file list** (it shouldn't be; `.gitignore` excludes it). If it is somehow present, delete it from the repo immediately and rotate your Supabase anon key.

---

## Step 2 — Create the Vercel project

1. Go to <https://vercel.com/new>
2. Click **Import Git Repository**, pick `savemyhands`
3. Vercel auto-detects Next.js. **Don't change** Framework Preset, Build Command, Output Directory, or Install Command — they're already correct.
4. Expand the **Environment Variables** section. Add two variables:

   | Name | Value | Environments |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | (copy from your local `.env.local`) | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (copy from your local `.env.local`) | Production, Preview, Development |

5. Click **Deploy**. The first build takes ~2 minutes.
6. When it finishes, Vercel gives you a URL like `https://savemyhands-xyz.vercel.app`. **Copy this URL** — you'll need it in step 3.

If the build fails, click into the build log and look for the first red error. The most common cause is a missing env var — check that both `NEXT_PUBLIC_*` are set.

---

## Step 3 — Wire Supabase to the production URL

This is the step everyone forgets. Without it, login works on localhost but breaks in production with redirect errors.

1. Go to <https://supabase.com/dashboard> → pick your project
2. Sidebar: **Authentication → URL Configuration**
3. **Site URL**: replace whatever's there (probably `http://localhost:3000`) with your Vercel URL: `https://savemyhands-xyz.vercel.app`
4. **Redirect URLs** (allowlist below Site URL): add **all of these** by clicking "Add URL" for each one:
   - `https://savemyhands-xyz.vercel.app/auth/callback`
   - `https://savemyhands-xyz.vercel.app/**` (wildcard catch-all)
   - `http://localhost:3000/auth/callback` (so local dev keeps working)
   - `http://localhost:3000/**` (same)
5. Click **Save**

---

## Step 4 — OAuth provider redirect URLs (only if you set up Google/Discord)

If you've enabled the Google or Discord buttons in Supabase, each provider's OAuth app has its own allowlist. Supabase exposes a single callback URL (`https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`) — this is what providers redirect to, **not** your Vercel URL.

If you set this up earlier when getting OAuth working locally, you don't need to change anything here. If you haven't set up the OAuth providers yet:

- **Google**: Go to <https://console.cloud.google.com/apis/credentials>. Edit your OAuth 2.0 Client ID. Under "Authorized redirect URIs", add `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`. The exact URL is shown in Supabase dashboard → Authentication → Providers → Google.
- **Discord**: Go to <https://discord.com/developers/applications>. Open your application → OAuth2 → Redirects. Add the same Supabase callback URL shown in Supabase dashboard → Authentication → Providers → Discord.

---

## Step 5 — Smoke test the production deployment

Open `https://savemyhands-xyz.vercel.app` in a private/incognito window and run through:

- [ ] Landing page (`/`) renders with hero, How it works, FAQ
- [ ] Click **Sign up**, create an account with a real email you can check
- [ ] Email confirmation: open the email, click the confirmation link, lands you on `/dashboard`
- [ ] On `/dashboard`, click "Set username" banner, pick a username, save
- [ ] Click **Record hand**, fill in seats / cards / a few actions, complete a hand to showdown
- [ ] Save the hand → opens the replayer at `/hand/<id>`
- [ ] In the replayer header, toggle the lock to **Public** (URL gets copied)
- [ ] Open that copied URL in a different private window — should render the hand without a login
- [ ] Back on the original session: open `/settings`, change password, sign out, sign back in with the new password
- [ ] **OAuth (only if enabled)**: from a new private window, click "Continue with Google" / "Continue with Discord" — should complete and land you at `/dashboard`

If any of these fail, **95% of the time it's the redirect allowlist** in step 3. Re-check those URLs character-for-character.

---

## Step 6 — Custom domain (optional, do whenever)

Skip this if you're fine with the `vercel.app` URL for now.

1. Buy a domain at any registrar (Namecheap, Cloudflare, Google Domains, etc.)
2. Vercel project → **Settings → Domains** → Add your domain
3. Vercel shows you the exact DNS records to set. Typically one CNAME or A record at your registrar.
4. After DNS propagates (usually minutes, can take up to 48 hours): Vercel auto-issues an SSL cert.
5. **Important**: go back to **Supabase → Authentication → URL Configuration** and update Site URL + redirect allowlist to use the custom domain. The Vercel URL stops being the canonical one.

---

## Step 7 — Production safety knobs (worth doing before sharing the URL widely)

These don't block launch but tighten the screws.

1. **Supabase rate limiting** (Authentication → Rate Limits). Defaults are sensible for personal projects but you can lower the per-IP signup rate if you're worried about spam.
2. **Email templates** (Authentication → Email Templates). The default confirmation email says "Supabase". Customize the subject and body to mention savemyhands so it doesn't look like phishing.
3. **Email provider** (Authentication → SMTP Settings). Supabase's default email sender has a low daily limit (~3-4 emails/hour on free tier). For real use, configure a transactional email provider like Resend (free tier covers 100/day) so signup emails go out reliably.
4. **Check the Vercel deployment is on the right Node version**. In Vercel project settings → General, confirm Node version is 20.x or 22.x.

---

## Notes for future deploys

After the initial setup, every subsequent deploy is automatic:

- Push to `main` on GitHub → Vercel builds and deploys to production within ~2 minutes
- Push to any other branch → Vercel builds a preview URL (visible on the GitHub PR / commit page)

**To apply a new database migration**:

1. Add the new file to `supabase/migrations/000N_whatever.sql`
2. Open Supabase → SQL Editor → New Query → paste the migration → Run
3. Verify it applied: query `pg_tables` / `pg_proc` for the new objects
4. Commit and push the migration file alongside any code that depends on it

**To roll back a bad deploy**:

- Vercel dashboard → Deployments → find the last good one → click the "..." menu → "Promote to Production"
- Vercel doesn't roll back database state. If you need to roll back a migration too, you'll need to write a reverse migration manually.

---

## What to do if something breaks

| Symptom | Likely cause |
|---|---|
| Page loads but auth redirects to a 404 or "not allowed" | Redirect allowlist (step 3) missing the production URL |
| `Invalid login credentials` for an account that should work | Email confirmation never happened — check spam, or re-trigger from Supabase → Authentication → Users |
| `Failed to fetch` errors in the browser console | Env vars not set on Vercel — re-check both `NEXT_PUBLIC_*` are present in Vercel project settings |
| Build fails with "module not found" | A dependency wasn't committed — `git status`, commit any untracked files, push |
| Saved hand returns "Hand payload is too large" | Server-side input cap kicked in. This is intentional protection; tell the user to shorten their notes/annotations. |
| Database migrations error in SQL Editor | Migrations have to run in order (0001 → 0002 → 0003 → 0004). Re-check which ones have been applied with the queries in the Prerequisites section. |

If you get stuck on something not in the table above, paste the exact error message into a new Claude chat along with this file and the URL of the page that's failing.
