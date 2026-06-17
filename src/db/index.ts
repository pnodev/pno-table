import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { env } from '#/env'

import * as schema from './schema.ts'

const dbPath = join(env.PNO_DATA_DIR, 'pno-table.sqlite')

mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)

sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
