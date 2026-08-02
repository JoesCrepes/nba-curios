-- Local source of truth for tracking data. Hardcover is only ever a metadata
-- feed into `books`/`authors`/`editions` (see hardcover/sync.ts) -- nothing
-- here depends on Hardcover's own user_books schema, so we can freely add
-- custom tags/rating dimensions/etc. later without fighting their API.

CREATE TABLE IF NOT EXISTS books (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  hardcover_id    INTEGER UNIQUE,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  description     TEXT,
  cover_image_url TEXT,
  release_date    TEXT,
  pages           INTEGER,
  series_name     TEXT,
  series_position REAL,
  compilation     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS authors (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  hardcover_id INTEGER UNIQUE,
  name         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_authors (
  book_id   INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'author',
  PRIMARY KEY (book_id, author_id, role)
);

-- One row per known edition of a book (audiobook, ebook, physical, ...).
-- `format` is what the rest of the app filters on -- e.g. "only show me
-- audiobook editions when checking Libby availability".
CREATE TABLE IF NOT EXISTS editions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  hardcover_id    INTEGER UNIQUE,
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  format          TEXT NOT NULL CHECK (format IN ('audiobook', 'ebook', 'physical', 'other')),
  isbn_10         TEXT,
  isbn_13         TEXT,
  asin            TEXT,
  audio_seconds   INTEGER,
  publisher       TEXT,
  release_date    TEXT,
  language        TEXT,
  narrators       TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_editions_book_id ON editions(book_id);
CREATE INDEX IF NOT EXISTS idx_editions_format ON editions(format);
CREATE INDEX IF NOT EXISTS idx_editions_isbn13 ON editions(isbn_13);

-- Personal tracking data -- entirely our own schema, one row per book,
-- covers the full lifecycle from TBR through finished/DNF.
CREATE TABLE IF NOT EXISTS user_books (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id          INTEGER NOT NULL UNIQUE REFERENCES books(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'want_to_read'
                   CHECK (status IN ('want_to_read', 'reading', 'read', 'on_hold', 'dnf')),
  preferred_format TEXT CHECK (preferred_format IN ('audiobook', 'ebook', 'physical')),
  rating           REAL CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  review           TEXT,
  notes            TEXT,
  started_at       TEXT,
  finished_at      TEXT,
  added_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_books_status ON user_books(status);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS user_book_tags (
  user_book_id INTEGER NOT NULL REFERENCES user_books(id) ON DELETE CASCADE,
  tag_id       INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (user_book_id, tag_id)
);

-- A cloned Libby "identity" (see libby/client.ts for the chip/clone/sync
-- flow). One account can carry several linked library cards.
CREATE TABLE IF NOT EXISTS libby_accounts (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  label                  TEXT NOT NULL DEFAULT 'default',
  identity_token_encrypted TEXT NOT NULL,
  linked_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_synced_at         TEXT
);

CREATE TABLE IF NOT EXISTS libraries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  libby_account_id INTEGER NOT NULL REFERENCES libby_accounts(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  library_key     TEXT NOT NULL,
  website_id      INTEGER,
  card_id         TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  UNIQUE (libby_account_id, library_key)
);

-- Cached results of the last Libby availability lookup for a
-- (book, format, library) triple, so the UI doesn't have to hit
-- OverDrive's undocumented endpoints on every page load.
CREATE TABLE IF NOT EXISTS availability_checks (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id               INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  edition_format        TEXT NOT NULL CHECK (edition_format IN ('audiobook', 'ebook')),
  library_id            INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  overdrive_title_id    TEXT,
  is_owned              INTEGER,
  is_available          INTEGER,
  owned_copies          INTEGER,
  available_copies      INTEGER,
  holds_count           INTEGER,
  estimated_wait_days   INTEGER,
  checked_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_availability_book ON availability_checks(book_id, edition_format);
