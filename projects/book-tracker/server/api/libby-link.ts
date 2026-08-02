import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAnonymousIdentity, linkWithCloneCode, syncLibraries } from '../src/libby/client'

/**
 * Stateless POC endpoint -- validates the Libby account-link flow
 * (chip -> clone/code -> sync). Nothing is stored: the identity token is
 * used once for this request and discarded. Separate from availability
 * checking, which doesn't need this at all -- only useful if you want to
 * confirm the clone-code auth flow itself still works against a real
 * account.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const code = String((req.body ?? {}).code ?? '')
  try {
    const identity = await getAnonymousIdentity()
    await linkWithCloneCode(identity, code)
    const libraries = await syncLibraries(identity)
    res.status(200).json({ libraries })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Link failed' })
  }
}
