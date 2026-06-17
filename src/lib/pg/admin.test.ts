import { describe, expect, it } from 'vitest'

import { buildDatabasePrivilegeStatement, formatRoleSql } from '#/lib/pg/admin'

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
