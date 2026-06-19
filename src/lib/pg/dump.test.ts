import { describe, expect, it } from 'vitest'

import { buildPgDumpArgs, buildPsqlArgs } from '#/lib/pg/dump'

describe('buildPgDumpArgs', () => {
  it('builds default plain-text dump args', () => {
    expect(buildPgDumpArgs({})).toEqual([
      '--no-password',
      '--format=plain',
      '--no-owner',
      '--no-privileges',
    ])
  })

  it('adds schema-only and data-only flags', () => {
    expect(buildPgDumpArgs({ schemaOnly: true, noOwner: false })).toEqual([
      '--no-password',
      '--format=plain',
      '--schema-only',
      '--no-privileges',
    ])

    expect(buildPgDumpArgs({ dataOnly: true, noPrivileges: false })).toEqual([
      '--no-password',
      '--format=plain',
      '--data-only',
      '--no-owner',
    ])
  })
})

describe('buildPsqlArgs', () => {
  it('builds default import args', () => {
    expect(buildPsqlArgs({})).toEqual([
      '--no-password',
      '--echo-errors',
      '--single-transaction',
      '--set',
      'ON_ERROR_STOP=on',
    ])
  })

  it('omits optional flags when disabled', () => {
    expect(
      buildPsqlArgs({ singleTransaction: false, onErrorStop: false }),
    ).toEqual(['--no-password', '--echo-errors'])
  })
})
