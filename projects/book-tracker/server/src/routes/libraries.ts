import { Router } from 'express'
import { db } from '../db/connection.js'
import { requireLibbyEncKey } from '../config.js'
import { encrypt, decrypt } from '../lib/crypto.js'
import { getAnonymousIdentity, linkWithCloneCode, syncLibraries } from '../libby/client.js'

export const librariesRouter = Router()

librariesRouter.get('/', (_req, res) => {
  const libraries = db
    .prepare(
      `SELECT l.id, l.name, l.library_key, l.website_id, l.is_active, a.label AS account_label, a.last_synced_at
       FROM libraries l
       JOIN libby_accounts a ON a.id = l.libby_account_id
       ORDER BY l.name`,
    )
    .all()
  res.json({ libraries })
})

// Link a Libby account using the 8-digit code from Libby's app:
// Settings -> "Copy to another device". This clones that device's identity
// (same mechanism Libby uses to add a device), so it inherits whatever
// library cards are already linked in the Libby app.
librariesRouter.post('/link', async (req, res, next) => {
  try {
    const code = String(req.body?.code ?? '')
    const key = requireLibbyEncKey()

    const identity = await getAnonymousIdentity()
    await linkWithCloneCode(identity, code)
    const linked = await syncLibraries(identity)

    const label = `Libby (${new Date().toISOString().slice(0, 10)})`
    const accountId = db
      .prepare(
        `INSERT INTO libby_accounts (label, identity_token_encrypted, last_synced_at)
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
      )
      .run(label, encrypt(identity, key)).lastInsertRowid as number

    const insertLibrary = db.prepare(`
      INSERT INTO libraries (libby_account_id, name, library_key, website_id, card_id)
      VALUES (@account_id, @name, @library_key, @website_id, @card_id)
      ON CONFLICT(libby_account_id, library_key) DO UPDATE SET name = excluded.name, card_id = excluded.card_id
    `)
    for (const lib of linked) {
      insertLibrary.run({
        account_id: accountId,
        name: lib.name,
        library_key: lib.libraryKey,
        website_id: lib.websiteId,
        card_id: lib.cardId,
      })
    }

    const libraries = db.prepare('SELECT id, name, library_key, is_active FROM libraries WHERE libby_account_id = ?').all(accountId)
    res.json({ libraries })
  } catch (err) {
    next(err)
  }
})

librariesRouter.post('/:id/resync', async (req, res, next) => {
  try {
    const key = requireLibbyEncKey()
    const library = db.prepare('SELECT * FROM libraries WHERE id = ?').get(Number(req.params.id)) as
      | { id: number; libby_account_id: number; library_key: string }
      | undefined
    if (!library) return res.status(404).json({ error: 'Not found' })

    const account = db.prepare('SELECT * FROM libby_accounts WHERE id = ?').get(library.libby_account_id) as {
      id: number
      identity_token_encrypted: string
    }
    const identity = decrypt(account.identity_token_encrypted, key)
    const linked = await syncLibraries(identity)
    const match = linked.find((l) => l.libraryKey === library.library_key)
    if (match) {
      db.prepare('UPDATE libraries SET name = ? WHERE id = ?').run(match.name, library.id)
    }
    db.prepare(`UPDATE libby_accounts SET last_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`).run(account.id)
    res.json({ ok: true, stillLinked: Boolean(match) })
  } catch (err) {
    next(err)
  }
})

librariesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM libraries WHERE id = ?').run(Number(req.params.id))
  res.status(204).end()
})
