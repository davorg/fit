# Setup Guide – Google Sign-In with Supabase

This guide covers all the manual steps needed to enable Google authentication and cloud progress storage.

---

## Step 1 – Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **New project**.
3. Choose an organisation, give the project a name (e.g. `fit`), set a database password, and pick a region close to your users.
4. Click **Create new project** and wait for it to be provisioned (usually under a minute).

---

## Step 2 – Create the progress table

1. In your Supabase project, open the **SQL Editor** (left sidebar).
2. Paste the following SQL and click **Run**:

```sql
-- Table that stores one row per user per task
CREATE TABLE public.progress (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id      TEXT        NOT NULL,
  completed    BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT progress_user_task_unique UNIQUE (user_id, task_id)
);

-- Enable Row Level Security so users can only see their own rows
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own progress"
  ON public.progress
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Step 3 – Enable Google OAuth

### 3a. Create a Google OAuth application

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services → Credentials**.
4. Click **Create Credentials → OAuth client ID**.
5. Set the application type to **Web application**.
6. Under **Authorised redirect URIs**, add:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Replace `<your-project-ref>` with the reference shown in your Supabase project URL.
7. Click **Create** and copy the **Client ID** and **Client Secret**.

### 3b. Add Google as a provider in Supabase

1. In your Supabase project, go to **Authentication → Providers**.
2. Find **Google** and click **Enable**.
3. Paste the **Client ID** and **Client Secret** from the previous step.
4. Click **Save**.

---

## Step 4 – Set the Site URL

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to the URL where the app is hosted, e.g.:
   - For GitHub Pages: `https://<username>.github.io/<repo>/`
   - For local development: `http://localhost:3000` (or wherever you serve the files)
3. Under **Redirect URLs**, add the same URL (Supabase requires it to be explicitly allowed).
4. Click **Save**.

---

## Step 5 – Update config.js

1. In your Supabase project, go to **Project Settings → API**.
2. Copy the **Project URL** and the **`anon` public key**.
3. Open `config.js` in this repository and replace the placeholder values:

```js
const SUPABASE_URL = 'https://<your-project-ref>.supabase.co';
const SUPABASE_ANON_KEY = '<your-anon-key>';
```

> **Note:** The `anon` key is designed to be public. Row Level Security (RLS) policies
> (set up in Step 2) ensure that users can only read and write their own progress rows.

---

## Step 6 – Deploy

Commit and push `config.js` with the real credentials, then deploy via GitHub Pages (or your chosen host).  
Users can now click **Sign in with Google**, authorise the app, and have their progress stored in the cloud and synced across devices.

---

## How it works

| State | Progress storage |
|-------|-----------------|
| Not signed in | Browser `localStorage` (existing behaviour) |
| Signed in | Supabase `progress` table, keyed to the user's ID |

Signing out returns the app to anonymous mode; any locally-stored progress is still available.
