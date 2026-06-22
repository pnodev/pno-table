import { randomUUID } from 'node:crypto'

import { decryptSecret, encryptSecret } from '#/lib/crypto'
import type { PostgresConnectionConfig } from '#/lib/connections/types'

const SESSION_TTL_MS = 30 * 60 * 1000

type StoredImportSession = {
  configEncrypted: string
  sourceDatabase: string | null
  createdAt: number
  expiresAt: number
}

const sessions = new Map<string, StoredImportSession>()

function cleanupExpiredSessions(now = Date.now()) {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(id)
    }
  }
}

function serializeConfig(config: PostgresConnectionConfig): string {
  return encryptSecret(JSON.stringify(config))
}

function deserializeConfig(payload: string): PostgresConnectionConfig {
  return JSON.parse(decryptSecret(payload)) as PostgresConnectionConfig
}

export function createImportSession(
  config: PostgresConnectionConfig,
  sourceDatabase?: string | null,
): string {
  cleanupExpiredSessions()

  const id = randomUUID()
  const now = Date.now()

  sessions.set(id, {
    configEncrypted: serializeConfig(config),
    sourceDatabase: sourceDatabase ?? null,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  })

  return id
}

export function getImportSession(sessionId: string): {
  config: PostgresConnectionConfig
  sourceDatabase: string | null
} | null {
  cleanupExpiredSessions()

  const session = sessions.get(sessionId)

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return null
  }

  return {
    config: deserializeConfig(session.configEncrypted),
    sourceDatabase: session.sourceDatabase,
  }
}

export function setImportSessionDatabase(
  sessionId: string,
  database: string,
): boolean {
  const session = sessions.get(sessionId)

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return false
  }

  session.sourceDatabase = database
  session.expiresAt = Date.now() + SESSION_TTL_MS
  return true
}

export function endImportSession(sessionId: string): void {
  sessions.delete(sessionId)
}

export function touchImportSession(sessionId: string): boolean {
  const session = sessions.get(sessionId)

  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return false
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS
  return true
}

export function clearImportSessionsForTests(): void {
  sessions.clear()
}
