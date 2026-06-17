import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  host: text('host').notNull(),
  port: integer('port').notNull().default(5432),
  username: text('username').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  defaultDatabase: text('default_database').notNull().default('postgres'),
  sslMode: text('ssl_mode', { enum: ['disable', 'prefer', 'require'] })
    .notNull()
    .default('prefer'),
  readOnly: integer('read_only', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
})
