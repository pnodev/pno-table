import { describe, expect, it } from 'vitest'

import { quoteIdentifier, quoteQualifiedName } from '#/lib/pg/identifiers'

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
