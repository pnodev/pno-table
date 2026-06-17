import { describe, expect, it } from 'vitest'

import { buildRowBrowseFilterClause } from '#/lib/pg/row-browse-filter'

const columns = ['id', 'name', 'email']

describe('buildRowBrowseFilterClause', () => {
  it('returns no clause without filters', () => {
    expect(buildRowBrowseFilterClause({ allowedColumns: columns })).toEqual({
      clause: '',
      values: [],
    })
  })

  it('builds an exact column filter', () => {
    expect(
      buildRowBrowseFilterClause({
        allowedColumns: columns,
        filterColumn: 'email',
        filterValue: 'alice@example.com',
        filterOp: 'eq',
      }),
    ).toEqual({
      clause: 'where "email"::text = $1',
      values: ['alice@example.com'],
    })
  })

  it('builds a contains column filter', () => {
    expect(
      buildRowBrowseFilterClause({
        allowedColumns: columns,
        filterColumn: 'name',
        filterValue: 'ali',
        filterOp: 'contains',
      }),
    ).toEqual({
      clause: 'where "name"::text ilike $1',
      values: ['%ali%'],
    })
  })

  it('builds a global search across all columns', () => {
    expect(
      buildRowBrowseFilterClause({
        allowedColumns: columns,
        q: 'alice',
      }),
    ).toEqual({
      clause:
        'where ("id"::text ilike $1 or "name"::text ilike $1 or "email"::text ilike $1)',
      values: ['%alice%'],
    })
  })

  it('combines column filter and global search', () => {
    expect(
      buildRowBrowseFilterClause({
        allowedColumns: columns,
        filterColumn: 'name',
        filterValue: 'Alice',
        filterOp: 'eq',
        q: 'example',
      }),
    ).toEqual({
      clause:
        'where "name"::text = $1 and ("id"::text ilike $2 or "name"::text ilike $2 or "email"::text ilike $2)',
      values: ['Alice', '%example%'],
    })
  })

  it('ignores unknown columns and empty values', () => {
    expect(
      buildRowBrowseFilterClause({
        allowedColumns: columns,
        filterColumn: 'missing',
        filterValue: 'x',
        q: '   ',
      }),
    ).toEqual({
      clause: '',
      values: [],
    })
  })
})
