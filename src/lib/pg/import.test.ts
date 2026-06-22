import { describe, expect, it } from 'vitest'

import {
  buildImportPgDumpArgs,
  detectPoolerWarning,
} from '#/lib/pg/import'

describe('buildImportPgDumpArgs', () => {
  it('builds full-database dump args', () => {
    expect(
      buildImportPgDumpArgs(
        { mode: 'database', schemas: [], tables: [] },
        {},
      ),
    ).toEqual([
      '--no-password',
      '--format=plain',
      '--no-owner',
      '--no-privileges',
    ])
  })

  it('adds schema flags for schema selection', () => {
    expect(
      buildImportPgDumpArgs(
        { mode: 'schemas', schemas: ['public', 'app'], tables: [] },
        { schemaOnly: true, noOwner: false },
      ),
    ).toEqual([
      '--no-password',
      '--format=plain',
      '--schema-only',
      '--no-privileges',
      '--schema',
      'public',
      '--schema',
      'app',
    ])
  })

  it('adds table flags for table selection', () => {
    expect(
      buildImportPgDumpArgs(
        {
          mode: 'tables',
          schemas: [],
          tables: [
            { schema: 'public', name: 'users' },
            { schema: 'app', name: 'orders' },
          ],
        },
        { dataOnly: true, noPrivileges: false },
      ),
    ).toEqual([
      '--no-password',
      '--format=plain',
      '--data-only',
      '--no-owner',
      '--table',
      'public.users',
      '--table',
      'app.orders',
    ])
  })
})

describe('detectPoolerWarning', () => {
  it('warns for neon-style pooler hosts', () => {
    expect(detectPoolerWarning('ep-foo-pooler.eu-west-2.aws.neon.tech')).toMatch(
      /pooler/i,
    )
    expect(detectPoolerWarning('db.pooler.example.com')).toMatch(/pooler/i)
  })

  it('returns null for direct hosts', () => {
    expect(detectPoolerWarning('ep-foo.eu-west-2.aws.neon.tech')).toBeNull()
    expect(detectPoolerWarning('localhost')).toBeNull()
  })
})
