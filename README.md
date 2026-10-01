# JIMRAMI

A browser-based score and session tracker for our family card game.

JIMRAMI stores data locally in the browser with Dexie. Supabase is optional and adds cloud backup and syncing between devices.

## Run locally

```bash
npm install
npm run dev
```

## Supabase cloud sync

### 1. Create a Supabase project

Create a new Supabase project.

Recommended setup:

- Data API: **On**
- Automatically expose new tables: **Off**
- Row Level Security (RLS): **On**

Keep the database password private.

### 2. Create the database

Open:

**Supabase → SQL Editor**

Run:

[`supabase/schema.sql`](supabase/schema.sql)

This creates the JIMRAMI cloud tables and RLS policies.

### 3. Create the cloud user

Open:

**Supabase → Authentication → Users → Add user**

Create an email/password user.

Use the same Supabase account on every device that should share the same JIMRAMI data.

### 4. Add local environment variables

From your Supabase project, copy the:

- Project URL
- Publishable key

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Restart the dev server after changing `.env.local`:

```bash
npm run dev
```

Never commit `.env.local`, the database password, or a Supabase secret/service-role key.

### 5. GitHub Pages

GitHub Pages also needs the same two values during the Vite build.

Add these repository secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Then expose them to the `npm run build` step in `.github/workflows/deploy.yml`:

```yaml
- name: Build
  run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
```

Push normally after changing the workflow:

```bash
git add .
git commit -m "Configure Supabase"
git push
```

GitHub Actions builds `dist` and deploys it to GitHub Pages.

## How cloud sync works

JIMRAMI always saves gameplay locally first.

- **Device → Cloud:** changes upload automatically. **Cloud Backup** manually pushes the current device data to Supabase.
- **Cloud → Device:** newer cloud data downloads automatically when it is safe to do so.
- Revision checks stop one device from overwriting newer data from another device.
- If a sync fails, local gameplay still works and JIMRAMI keeps the change pending for a retry.
- Without Supabase configuration, JIMRAMI stays in local-only mode.
