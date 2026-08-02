import 'dotenv/config'
import path from 'node:path'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var ${name} (see .env.example)`)
  return value
}

export const config = {
  port: Number(process.env.PORT ?? 4310),
  dbPath: path.resolve(process.env.DB_PATH ?? './data/book-tracker.db'),
  hardcoverToken: process.env.HARDCOVER_API_TOKEN ?? '',
  libbyTokenEncKey: process.env.LIBBY_TOKEN_ENC_KEY ?? '',
}

export function requireHardcoverToken(): string {
  if (!config.hardcoverToken) required('HARDCOVER_API_TOKEN')
  return config.hardcoverToken
}

export function requireLibbyEncKey(): Buffer {
  if (!config.libbyTokenEncKey) required('LIBBY_TOKEN_ENC_KEY')
  const key = Buffer.from(config.libbyTokenEncKey, 'hex')
  if (key.length !== 32) {
    throw new Error('LIBBY_TOKEN_ENC_KEY must be 32 bytes of hex (64 hex chars)')
  }
  return key
}
