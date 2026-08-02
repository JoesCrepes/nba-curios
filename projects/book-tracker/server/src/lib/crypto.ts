import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM at-rest encryption for the Libby identity token, so the
// sqlite file isn't a plaintext credential dump if it's ever copied
// around. This is defense in depth, not a substitute for keeping
// LIBBY_TOKEN_ENC_KEY out of the repo (it's gitignored via .env).
const ALGO = 'aes-256-gcm'

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv, authTag, ciphertext].map((b) => b.toString('base64')).join('.')
}

export function decrypt(payload: string, key: Buffer): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split('.')
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Malformed encrypted payload')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
