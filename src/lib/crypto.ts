import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto'

import { env } from '#/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const secret = env.PNO_MASTER_KEY

  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex')
  }

  return scryptSync(secret, 'pno-table-salt', 32)
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}

export function decryptSecret(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.')

  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid encrypted secret payload')
  }

  const iv = Buffer.from(ivPart, 'base64url')
  const authTag = Buffer.from(tagPart, 'base64url')
  const encrypted = Buffer.from(dataPart, 'base64url')
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)

  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}
