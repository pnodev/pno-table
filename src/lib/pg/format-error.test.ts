import { describe, expect, it } from 'vitest'

import { formatConnectionError } from '#/lib/pg/format-error'

describe('formatConnectionError', () => {
  it('uses nested messages from AggregateError', () => {
    const error = new AggregateError(
      [new Error('connect ECONNREFUSED 127.0.0.1:5432')],
      '',
      { code: 'ECONNREFUSED' },
    )

    expect(formatConnectionError(error)).toBe(
      'connect ECONNREFUSED 127.0.0.1:5432',
    )
  })

  it('falls back to a generic message', () => {
    expect(formatConnectionError({})).toBe('Failed to connect to Postgres')
  })
})
