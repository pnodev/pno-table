import { describe, expect, it, vi } from 'vitest'

import {
  buildDatabasePrivilegeStatement,
  emptyDatabase,
  formatRoleSql,
  truncateDatabase,
} from '#/lib/pg/admin'

describe('buildDatabasePrivilegeStatement', () => {
  it('builds grant connect statements', () => {
    expect(
      buildDatabasePrivilegeStatement(
        'grant',
        'CONNECT',
        'myapp',
        'reader',
      ),
    ).toBe('grant CONNECT on database "myapp" to "reader"')
  })

  it('builds revoke create statements', () => {
    expect(
      buildDatabasePrivilegeStatement(
        'revoke',
        'CREATE',
        'analytics',
        'writer',
      ),
    ).toBe('revoke CREATE on database "analytics" from "writer"')
  })

  it('uses PUBLIC keyword for the public role', () => {
    expect(
      buildDatabasePrivilegeStatement(
        'revoke',
        'CONNECT',
        'myapp',
        'PUBLIC',
      ),
    ).toBe('revoke CONNECT on database "myapp" from PUBLIC')
  })
})

describe('formatRoleSql', () => {
  it('formats regular roles with quotes', () => {
    expect(formatRoleSql('reader')).toBe('"reader"')
  })

  it('uses PUBLIC keyword for the public role', () => {
    expect(formatRoleSql('PUBLIC')).toBe('PUBLIC')
  })
})

describe('truncateDatabase', () => {
  it('truncates all user tables with restart identity cascade', async () => {
    const queries: string[] = []
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql)

        if (sql.includes('pg_stat_activity')) {
          return { rows: [] }
        }

        return {
          rows: [
            { schema_name: 'public', table_name: 'users' },
            { schema_name: 'app', table_name: 'events' },
          ],
        }
      }),
    }

    await truncateDatabase(client as never)

    expect(queries).toHaveLength(3)
    expect(queries[1]).toContain('from pg_catalog.pg_class')
    expect(queries[2]).toBe(
      'truncate table "public"."users", "app"."events" restart identity cascade',
    )
  })

  it('skips truncate when there are no user tables', async () => {
    const queries: string[] = []
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql)
        return { rows: [] }
      }),
    }

    await truncateDatabase(client as never)

    expect(queries).toHaveLength(2)
    expect(queries.some((sql) => sql.startsWith('truncate table'))).toBe(false)
  })
})

describe('emptyDatabase', () => {
  it('drops user objects in dependency order', async () => {
    const queries: string[] = []
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql)
        return { rows: [] }
      }),
    }

    await emptyDatabase(client as never)

    expect(queries).toHaveLength(2)
    expect(queries[1]).toContain('drop view if exists %I.%I cascade')
    expect(queries[1]).toContain('drop materialized view if exists %I.%I cascade')
    expect(queries[1]).toContain('drop table if exists %I.%I cascade')
    expect(queries[1]).toContain('drop foreign table if exists %I.%I cascade')
    expect(queries[1]).toContain('drop sequence if exists %I.%I cascade')
    expect(queries[1]).toContain("d.deptype = 'a'")
  })
})
