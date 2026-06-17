import type { connections } from '#/db/schema'

export type ConnectionRecord = typeof connections.$inferSelect

export type ConnectionProfile = Omit<ConnectionRecord, 'passwordEncrypted'>

export type PostgresConnectionConfig = {
  host: string
  port: number
  username: string
  password: string
  defaultDatabase: string
  sslMode: 'disable' | 'prefer' | 'require'
}

export type ConnectionTestResult =
  | {
      ok: true
      version: string
      database: string
      latencyMs: number
    }
  | {
      ok: false
      error: string
    }
