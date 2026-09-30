# JIMRAMI

A local-first scorekeeper for the JIMRAMI family card game. [Go check it out!.](http://zainurdoto.github.io/jimrami/)

JIMRAMI works without an account, without Supabase, and without an internet connection. Game data is stored locally in the browser with Dexie / IndexedDB.

Supabase cloud backup and cross-device sync are optional.

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

With the current Vite base path, local development is normally available at:

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

- Dexie remains the working local database
- local changes sync automatically to Supabase
- failed syncs stay pending and retry after reconnecting
- deletions also sync to the cloud
- a fresh empty device can rebuild itself from the cloud
- an existing stale device can pull a newer cloud snapshot
- cloud revisions prevent an older device from blindly overwriting a newer cloud revision

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
- `sync_state`

It also enables Row Level Security. Each row belongs to the authenticated Supabase user through `owner_id`.

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
(optional shared cloud copy)
```

### Local changes

Normal local creates and updates trigger background cloud sync.

Local deletions are placed in a persistent deletion queue so the matching Supabase rows can be removed safely after reconnecting.

### Offline use

If the device is offline:

1. gameplay continues locally
2. the change is marked as pending
3. reconnecting triggers another sync attempt
4. the pending state clears after a successful upload

### Cross-device revision tracking

Supabase stores one shared revision number in `sync_state`.

Each device also stores the revision of its current local snapshot.

Example:

```text
Laptop local revision: 5
Cloud revision:        5

Laptop changes data
-> upload succeeds
-> cloud revision becomes 6

Tablet local revision: 5
Cloud revision:         6

Tablet becomes active
-> detects newer cloud revision
-> pulls the cloud snapshot
-> tablet local revision becomes 6
```

A fresh empty device with no local revision can also pull the current cloud snapshot automatically.

If a device has pending local work while the cloud is already newer, JIMRAMI does not automatically discard that local work. Automatic pull is skipped for safety.

### Important concurrency limitation

The current design is intended for sequential family use across devices, for example:

```text
laptop -> sync -> tablet -> sync -> laptop
```

Do not treat it as Google-Docs-style real-time multi-device editing.

Two devices should not actively edit the same JIMRAMI data at the same time. Revision tracking protects normal stale-device use, but this project does not implement full conflict merging for simultaneous edits.

## Backup and Restore

The Data panel supports:

- Export Backup to JSON
- Import Backup from JSON
- Cloud Backup
- Restore from Cloud

Cloud restore is intentionally restricted to an empty local database to reduce the risk of overwriting existing local data.

The Data panel also shows live cloud state such as:

- Connected
- Sync pending
- Offline
- Last synced time

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
