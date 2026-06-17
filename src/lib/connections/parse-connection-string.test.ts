import { describe, expect, it } from 'vitest'

import {
  parseConnectionString,
  suggestConnectionName,
} from '#/lib/connections/parse-connection-string'

describe('parseConnectionString', () => {
  it('parses a standard postgresql URL', () => {
    const result = parseConnectionString(
      'postgresql://myuser:secret@db.example.com:5433/appdb?sslmode=require',
    )

    expect(result).toEqual({
      ok: true,
      value: {
        host: 'db.example.com',
        port: 5433,
        username: 'myuser',
        password: 'secret',
        defaultDatabase: 'appdb',
        sslMode: 'require',
      },
    })
  })

  it('accepts postgres:// and URL-encoded credentials', () => {
    const result = parseConnectionString(
      'postgres://user:p%40ss@localhost/mydb',
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.password).toBe('p@ss')
      expect(result.value.port).toBe(5432)
      expect(result.value.sslMode).toBe('prefer')
    }
  })

  it('parses libpq key=value strings', () => {
    const result = parseConnectionString(
      "host=127.0.0.1 port=5432 dbname=analytics user=reader password='s3cret' sslmode=disable",
    )

    expect(result).toEqual({
      ok: true,
      value: {
        host: '127.0.0.1',
        port: 5432,
        username: 'reader',
        password: 's3cret',
        defaultDatabase: 'analytics',
        sslMode: 'disable',
      },
    })
  })

  it('rejects URLs without a password', () => {
    const result = parseConnectionString('postgresql://user@localhost/appdb')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Password')
    }
  })
})

describe('suggestConnectionName', () => {
  it('uses host and database when database is not postgres', () => {
    expect(
      suggestConnectionName({
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secret',
        defaultDatabase: 'myapp',
        sslMode: 'prefer',
      }),
    ).toBe('localhost/myapp')
  })
})
