import { describe, expect, it } from 'vitest'

import { createDatabaseSchema, identifierSchema } from '#/lib/pg/admin-schemas'

describe('identifierSchema', () => {
  it('accepts hyphenated names', () => {
    expect(identifierSchema.safeParse('project-y').success).toBe(true)
  })

  it('rejects names with spaces', () => {
    const result = identifierSchema.safeParse('project y')

    expect(result.success).toBe(false)
  })
})

describe('createDatabaseSchema', () => {
  it('accepts hyphenated database names', () => {
    expect(
      createDatabaseSchema.safeParse({
        name: 'project-y',
        encoding: 'UTF8',
      }).success,
    ).toBe(true)
  })
})
