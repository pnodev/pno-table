import { describe, expect, it } from 'vitest'

import { formatConnectionString } from '#/lib/connections/format-connection-string'
import { parseConnectionString } from '#/lib/connections/parse-connection-string'

describe('formatConnectionString', () => {
  it('formats a standard postgresql URL', () => {
    expect(
      formatConnectionString({
        host: 'db.example.com',
        port: 5433,
        username: 'myuser',
        password: 'secret',
        database: 'appdb',
        sslMode: 'require',
      }),
    ).toBe(
      'postgresql://myuser:secret@db.example.com:5433/appdb?sslmode=require',
    )
  })

  it('omits default port and includes sslmode', () => {
    expect(
      formatConnectionString({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
        database: 'postgres',
        sslMode: 'prefer',
      }),
    ).toBe('postgresql://postgres:secret@localhost/postgres?sslmode=prefer')
  })

  it('URL-encodes special characters in credentials', () => {
    const formatted = formatConnectionString({
      host: 'localhost',
      port: 5432,
      username: 'user',
      password: 'p@ss',
      database: 'mydb',
      sslMode: 'disable',
    })

    expect(formatted).toBe(
      'postgresql://user:p%40ss@localhost/mydb?sslmode=disable',
    )

    const parsed = parseConnectionString(formatted)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.password).toBe('p@ss')
      expect(parsed.value.defaultDatabase).toBe('mydb')
      expect(parsed.value.sslMode).toBe('disable')
    }
  })

  it('round-trips with parseConnectionString', () => {
    const original = {
      host: '127.0.0.1',
      port: 5432,
      username: 'reader',
      password: 's3cret',
      database: 'analytics',
      sslMode: 'disable' as const,
    }

    const formatted = formatConnectionString(original)
    const parsed = parseConnectionString(formatted)

    expect(parsed).toEqual({
      ok: true,
      value: {
        host: original.host,
        port: original.port,
        username: original.username,
        password: original.password,
        defaultDatabase: original.database,
        sslMode: original.sslMode,
      },
    })
  })
})
