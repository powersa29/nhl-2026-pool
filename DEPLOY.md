# Deploying the NHL 2026 Playoff Pool

**Total cost: $0/month** (Vercel free + Supabase free)

---

## Step 1 — Create a Supabase database (5 min)

1. Go to **https://supabase.com** → click **Start your project** → sign in with GitHub
2. Click **New project** → give it a name (e.g. `nhl-pool`) → set a database password → pick a region close to you → **Create new project**
3. Once the project is ready, click **SQL Editor** in the left sidebar
4. Paste the contents of `supabase-schema.sql` and click **Run**
5. Go to **Project Settings → API** and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key

---

## Step 2 — Push code to GitHub (2 min)

1. Create a new **private** repo at https://github.com/new (name it `nhl-pool`)
2. In this folder, open a terminal and run:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/nhl-pool.git
   git push -u origin main
   ```

---

## Step 3 — Deploy to Vercel (3 min)

1. Go to **https://vercel.com** → sign in with GitHub
2. Click **Add New → Project** → select your `nhl-pool` repo → click **Import**
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy** — Vercel will build and give you a URL like `nhl-pool-xyz.vercel.app`

**That's it!** Share the URL with your friends. The leaderboard updates from NHL.com every 10 minutes automatically.

---

## Cost breakdown

| Service      | Plan  | Cost        |
|-------------|-------|-------------|
| Vercel       | Hobby | **Free**    |
| Supabase     | Free  | **Free**    |
| NHL.com API  | Public| **Free**    |
| **Total**    |       | **$0/month**|

---

## Optional: Custom domain (e.g. `nhlpool.com`)

Domains cost ~**$12/year** from Namecheap or Google Domains. In Vercel, go to **Settings → Domains** to connect it.

---

## Updating the rounds bracket

Edit `lib/data.ts` → the `ROUNDS` array — update series scores and statuses, commit and push. Vercel auto-deploys in ~30 seconds.
