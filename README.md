# JIMRAMI

A local-first scorekeeper for the JIMRAMI family card game.

JIMRAMI works without an account, without Supabase, and without an internet connection. Game data is stored locally in the browser with Dexie / IndexedDB.

Supabase cloud backup and sync are optional.

## Quick Start

Requirements:

- Node.js
- npm

Clone the repository, then run:

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

For the current Vite base path, local development is normally available at:

```text
http://localhost:5173/jimrami/
```

No Supabase setup is required for local play.

## Data Modes

### Local Mode

If no Supabase environment variables are configured:

- JIMRAMI runs entirely from Dexie / IndexedDB
- no account is required
- normal gameplay works offline
- JSON Export / Import Backup remains available

### Optional Cloud Mode

When Supabase is configured and an authenticated user is signed in:

- local Dexie remains the working database
- changes sync automatically to Supabase
- failed syncs stay pending and retry after reconnecting
- deletions also sync to the cloud
- a fresh empty local database can be restored from the cloud

JIMRAMI is still local-first. Cloud failure should not stop a game.

## Optional Supabase Setup

### 1. Create a Supabase project

Create your own Supabase project. Each self-hosted JIMRAMI installation should use its own Supabase project rather than somebody else's database.

### 2. Create the database schema

Open:

```text
Supabase -> SQL Editor
```

Run:

```text
supabase/schema.sql
```

The schema creates these tables:

- `players`
- `sessions`
- `session_players`
- `rounds`
- `round_results`
- `jim_results`
- `penalty_results`

It also enables Row Level Security. Each row belongs to the authenticated user through `owner_id`.

### 3. Configure authentication

JIMRAMI cloud mode requires a Supabase Auth user.

For a private family installation, a simple setup is:

- use email/password authentication
- invite or create only the user(s) you want
- disable public sign-up if you do not want strangers creating accounts

Configure the Supabase Site URL / redirect URL for the address where JIMRAMI runs.

For local development with the current Vite base path:

```text
http://localhost:5173/jimrami/
```

A suitable local redirect allow-list entry is:

```text
http://localhost:5173/jimrami/**
```

For a deployed copy, use that deployment's real origin and `/jimrami/` path instead.

### 4. Create `.env.local`

Copy:

```text
.env.example
```

to:

```text
.env.local
```

Then fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Restart Vite after changing environment variables:

```bash
npm run dev
```

The Data panel should then show the cloud connection status.

## Security

Do not put a Supabase secret key or `service_role` key in this frontend project.

Only use the browser-safe publishable key:

```text
VITE_SUPABASE_PUBLISHABLE_KEY
```

The publishable key is not the main security boundary. Supabase Auth and Row Level Security protect the database.

`.env.local` should remain ignored by Git and must not be committed.

## Cloud Sync Behaviour

The intended architecture is:

```text
JIMRAMI
   |
   v
Dexie / IndexedDB
(local working copy)
   |
   v
Supabase
(optional cloud copy)
```

Normal local changes trigger background cloud sync when cloud mode is available.

If the device is offline:

1. gameplay continues locally
2. the change is marked as pending
3. reconnecting triggers another sync attempt
4. the pending state clears after a successful upload

Cloud deletion uses a persistent deletion queue so records removed locally can also be removed from Supabase after reconnecting.

For simplicity, use one active game device during a live session. This project does not currently try to provide Google-Docs-style simultaneous conflict resolution between multiple active devices.

## Backup and Restore

The Data panel supports:

- Export Backup to JSON
- Import Backup from JSON
- Cloud Backup
- Restore from Cloud

Cloud restore is intentionally restricted to an empty local database to reduce the risk of overwriting existing local data.

## Development Notes

Main technologies:

- React
- TypeScript
- Vite
- Dexie / IndexedDB
- Supabase (optional)

The app remains usable when Supabase is not configured.

## Repository Safety

Safe to commit:

```text
.env.example
supabase/schema.sql
source code
README.md
```

Do not commit:

```text
.env.local
Supabase secret/service-role keys
database passwords
```
