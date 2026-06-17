import { describe, expect, it } from 'vitest'

import { quoteIdentifier, quoteQualifiedName, quoteStringLiteral } from '#/lib/pg/identifiers'

describe('quoteIdentifier', () => {
  it('quotes identifiers with hyphens', () => {
    expect(quoteIdentifier('project-y_git_status_rule')).toBe(
      '"project-y_git_status_rule"',
    )
  })

  it('escapes embedded double quotes', () => {
    expect(quoteIdentifier('weird"name')).toBe('"weird""name"')
  })

  it('quotes simple identifiers', () => {
    expect(quoteQualifiedName('public', 'users')).toBe('"public"."users"')
  })
})

describe('quoteStringLiteral', () => {
  it('wraps values in single quotes', () => {
    expect(quoteStringLiteral('secret')).toBe("'secret'")
  })

  it('escapes embedded single quotes', () => {
    expect(quoteStringLiteral("pa'ss")).toBe("'pa''ss'")
  })
})
