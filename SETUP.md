# ClassPulse — Setup Guide (Supabase version)

Follow these steps in order. Total time: ~15 minutes.

## Step 1 — Create the Supabase project (3 min)

1. Go to **supabase.com** → Sign up / log in (GitHub login is fastest)
2. Click **New project**
3. Name: `classpulse` · set any database password (save it somewhere) · Region: Mumbai (ap-south-1)
4. Click **Create new project** and wait ~2 minutes while it provisions

## Step 2 — Create the database tables (2 min)

1. In your Supabase project, open **SQL Editor** (left sidebar)
2. Open the file `supabase-setup.sql` from this repo, copy **ALL** of it
3. Paste into the SQL editor → click **Run**
4. You should see "Success. No rows returned"

## Step 3 — Auth settings (1 min) — IMPORTANT

1. Left sidebar → **Authentication** → **Sign In / Providers**
2. Under **Email**, turn **OFF** "Confirm email"
3. Save

> Why: with confirmation on, every new account needs a verification email, and
> Supabase's built-in email service is rate-limited to just a few emails per hour —
> that would break your demo when multiple people sign up. With it off, signup is instant.

## Step 4 — Get your API keys (1 min)

1. Left sidebar → **Project Settings** (gear icon) → **Data API** (or "API")
2. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 5 — Paste keys into the code (2 min)

1. Open `src/config.js` in this repo (on GitHub: navigate to the file → click the pencil ✏️ to edit)
2. Replace the two placeholder strings with your real values
3. Commit the change

## Step 6 — Redeploy (automatic)

If the repo is connected to Vercel, committing triggers a redeploy automatically.
Wait ~2 minutes, then open your live URL.

## Step 7 — Test the full flow (5 min)

1. **On the laptop:** open the live URL → Create account → role **Teacher** →
   any email + password → fill profile → Start a session → the rotating QR appears
2. **On your phone:** open the same URL → Create account → role **Student** →
   different email + password → fill profile (name, roll, section)
3. **On your phone:** scan the laptop's QR with the camera → check-in flow runs →
   "You're marked present!"
4. **Watch the laptop:** your name pops into the live check-in feed instantly ✨
5. **On the laptop:** click "Push micro-quiz" → write a question → push
6. **On your phone:** the quiz pops up on your dashboard → answer it
7. Check **Analytics** on the laptop — real data appears in the roster

## Demo-day script (60 seconds)

1. Teacher laptop: session live, QR rotating with countdown
2. Judge/teammate phone: log in as student, scan → attendance appears in feed in real-time
3. The killer move: screenshot the QR, wait 15 s, scan the screenshot → **"Code expired"** —
   proxy attendance is dead
4. Push a micro-quiz → it pops on the phone instantly → answer → participation updates
5. Open Analytics → roster, at-risk flags, heatmap

## Troubleshooting

- **"Supabase not configured" screen** → Step 5 wasn't done or has a typo
- **Signup says "confirm your email"** → Step 3 wasn't done
- **Scan says "Session not found"** → the session was ended; start a new one
- **Feed not updating live** → refresh the teacher page; check Step 2 ran fully
  (the realtime lines are at the bottom of the SQL file)
