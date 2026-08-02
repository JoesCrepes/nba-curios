# Book Tracker

A personal reading tracker (replacing StoryGraph for me) with a built-in
checker for library availability via Libby/OverDrive, filtered by format
(audiobook vs. ebook).

This is a local-only app: a small Express + SQLite API and a React frontend,
meant to run on your own machine. The full app (`server/src`, the one with
persistent tracking data and a stored Libby account link) is **not** meant
to be deployed publicly. There's also a separate, stateless POC
(`server/api` + `server/public`) meant only for quick validation from a
browser without a local dev setup -- see "Vercel POC" below.

## Architecture

- **Hardcover's GraphQL API is a metadata source only.** Search results and
  book/edition data are pulled on demand and upserted into a local SQLite
  database (`server/data/book-tracker.db`). Nothing about the app's own
  status/rating/review data depends on Hardcover's schema -- that's tracked
  in a separate `user_books` table designed from scratch, so it can grow
  custom tags or rating dimensions later without fighting Hardcover's beta
  API.
- **Libby/OverDrive has no public developer API for individual accounts.**
  This talks to the same undocumented endpoints the Libby app itself uses
  (`sentry-read.svc.overdrive.com` for account linking,
  `thunder.api.overdrive.com` for the public, unauthenticated catalog/
  availability lookup), the way community tools like
  [odmpy](https://github.com/ping/odmpy) and
  [libby-calibre-plugin](https://github.com/ping/libby-calibre-plugin) do.
  It only ever reads availability data -- no downloads, no DRM.
- **Sync is on-demand**, triggered by search and by an explicit "resync"
  action on a book's detail page. There's no scheduled job; for personal
  scale, pulling fresh data when you look at a book is enough. (A cron/
  scheduled sync could be added later by calling the same
  `hardcover/sync.ts` functions from a script.)

See `server/src/db/schema.sql` for the full local schema (books, authors,
editions, user_books, libraries, availability_checks).

## Setup

### 1. Install

```bash
cd projects/book-tracker
npm install
```

### 2. Configure the server

```bash
cd server
cp .env.example .env
```

- `HARDCOVER_API_TOKEN` -- from your Hardcover account settings page
  (Settings -> API). Paste it exactly as given; a `Bearer ` prefix is added
  automatically if it's missing.
- `LIBBY_TOKEN_ENC_KEY` -- a random 32-byte hex key used to encrypt your
  linked Libby identity token at rest:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 3. Run

```bash
cd projects/book-tracker
npm run dev
```

This starts the API on `http://localhost:4310` and the frontend on
`http://localhost:5173` (proxying `/api` to the server). Open the frontend
URL.

### 4. Link a library (Libby)

In the Libby app: **Settings -> Copy to another device** (or "Manage
devices" on some versions) to get an 8-digit code. Paste it into this app's
Settings page. This clones your Libby device identity -- no password is
needed here, and it inherits whatever library cards are already linked in
your Libby account.

## Vercel POC

A stateless variant lives at `server/api` (+ a plain-HTML test page at
`server/public/index.html`) for quick validation from a phone/browser
without a local dev setup -- no database, nothing persists between
requests. It exercises the exact same `server/src/hardcover` and
`server/src/libby` modules the real app uses, just without the sqlite
sync/storage layer.

**Deploy it as its own Vercel project** (same pattern as
`projects/spotify-shared-taste`):

1. In Vercel: **Add New -> Project**, pick this repo.
2. **Root Directory**: `projects/book-tracker/server`. Framework preset:
   Other (it's picked up via `server/vercel.json`).
3. **Environment Variables**: add `HARDCOVER_API_TOKEN`. Nothing else is
   required -- the availability/link endpoints don't need any secrets
   (the OverDrive Thunder catalog API is public, and the Libby link
   endpoint doesn't store the identity token it gets back).
4. Deploy, then open the deployed URL. Three sections: search (Hardcover),
   availability check (Libby, takes a library key directly -- no account
   needed), and an optional account-link tester.

Since nothing is stored, this deployment is safe to leave public or tear
down whenever -- there's no database to leak and no long-lived credential
sitting on the server. Two things worth knowing before using it:

- It has no auth and no rate limiting of its own -- anyone with the URL
  can trigger Hardcover searches (against your token's 60 req/min limit)
  or attempt the Libby link flow. Fine for a short-lived personal check,
  not something to leave linked from anywhere public long-term.
- The availability endpoint takes a `libraryKey` directly (e.g. `dclibrary`
  for DC Public Library, guessed from their `dclibrary.overdrive.com` URL
  and pre-filled in the test page -- verify it's actually right once
  deployed, since it's unconfirmed).

## Caveats

- Hardcover's API is explicitly beta; GraphQL field names in
  `server/src/hardcover/queries.ts` are pinned to what's documented in
  [hardcoverapp/hardcover-docs](https://github.com/hardcoverapp/hardcover-docs)
  as of this writing and may need updates if their schema shifts.
- The Libby/OverDrive client is reverse-engineered and unofficial. The
  account-linking flow (`chip`, `chip/clone/code`, `chip/sync`) is
  cross-checked against multiple open-source reference clients. The
  catalog **search** endpoint (`libraries/{key}/media?query=...`) is the
  least-verified part -- its query parameters aren't documented anywhere
  public, so treat `server/src/libby/client.ts`'s `searchMedia()` as the
  first place to fix if availability checks stop finding matches. The
  availability endpoint itself is confirmed against
  [odmpy](https://github.com/ping/odmpy)'s implementation.
- If your library's OverDrive "key" (the slug used in the URL/API path)
  doesn't come through the sync payload the way `syncLibraries()` expects,
  linking will throw a clear error naming the card -- that's the field to
  adjust in `server/src/libby/client.ts`.

## Project layout

```
book-tracker/
├── server/                  # Express + better-sqlite3 API
│   └── src/
│       ├── db/              # schema.sql, connection, query helpers
│       ├── hardcover/       # GraphQL client + local sync
│       ├── libby/           # unofficial OverDrive client + availability
│       ├── routes/          # REST endpoints
│       └── lib/crypto.ts    # at-rest encryption for the Libby token
└── web/                     # React + Vite frontend
    └── src/
        ├── pages/           # Library, Search, BookDetail, Settings
        └── api.ts           # typed fetch wrapper around the API
```
