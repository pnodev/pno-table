import { describe, expect, it } from 'vitest'

import type { ColumnInfo, ForeignKeyInfo } from '#/lib/pg/catalog-types'
import {
  buildRelationFilterValues,
  formatForeignKeyOptionValue,
  getColumnRelation,
  getRelationLinkTarget,
  inferRelationForColumn,
  listColumnRelations,
} from '#/lib/pg/foreign-keys'

function column(overrides: Partial<ColumnInfo> = {}): ColumnInfo {
  return {
    name: 'col',
    dataType: 'text',
    isNullable: false,
    defaultValue: null,
    isPrimaryKey: false,
    isForeignKey: false,
    ...overrides,
  }
}

function foreignKey(overrides: Partial<ForeignKeyInfo> = {}): ForeignKeyInfo {
  return {
    name: 'fk_project',
    column: 'project_id',
    referencedSchema: 'public',
    referencedTable: 'project',
    referencedColumn: 'id',
    ...overrides,
  }
}

describe('getColumnRelation', () => {
  it('returns a single-column foreign key relation', () => {
    expect(
      getColumnRelation('project_id', [column({ name: 'project_id' })], 'public', [
        foreignKey(),
      ]),
    ).toMatchObject({
      source: 'constraint',
      column: 'project_id',
      referencedTable: 'project',
    })
  })

  it('returns composite foreign key relations for each column', () => {
    const keys = [
      foreignKey({ column: 'tenant_id', name: 'fk_tenant_project', referencedColumn: 'tenant_id' }),
      foreignKey({ column: 'project_id', name: 'fk_tenant_project' }),
    ]

    const relation = getColumnRelation(
      'project_id',
      [column({ name: 'project_id' }), column({ name: 'tenant_id' })],
      'public',
      keys,
    )

    expect(relation?.columns).toHaveLength(2)
    expect(relation?.column).toBe('project_id')
  })

  it('infers relations for *_id uuid columns without constraints', () => {
    expect(
      getColumnRelation(
        'status_id',
        [column({ name: 'status_id', dataType: 'uuid' })],
        'public',
        [],
      ),
    ).toMatchObject({
      source: 'inferred',
      referencedTable: 'status',
      columns: [{ column: 'status_id', referencedColumn: 'id' }],
    })
  })
})

describe('getRelationLinkTarget', () => {
  it('builds a browse filter for the referenced row', () => {
    expect(
      getRelationLinkTarget(
        {
          source: 'constraint',
          name: 'fk_project',
          column: 'project_id',
          columns: [{ column: 'project_id', referencedColumn: 'id' }],
          referencedSchema: 'public',
          referencedTable: 'project',
        },
        'project_id',
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).toEqual({
      schema: 'public',
      table: 'project',
      filterColumn: 'id',
      filterValue: '550e8400-e29b-41d4-a716-446655440000',
    })
  })
})

describe('inferRelationForColumn', () => {
  it('does not infer non-id suffix columns', () => {
    expect(inferRelationForColumn(column({ name: 'identifier' }), 'public')).toBeNull()
  })
})

describe('listColumnRelations', () => {
  it('deduplicates constraint and inferred relations by name', () => {
    const relations = listColumnRelations(
      [
        column({ name: 'project_id', dataType: 'uuid', isForeignKey: true }),
        column({ name: 'status_id', dataType: 'uuid' }),
      ],
      'public',
      [foreignKey()],
    )

    expect(relations).toHaveLength(2)
  })
})

describe('buildRelationFilterValues', () => {
  it('excludes the active column and empty values', () => {
    expect(
      buildRelationFilterValues(
        {
          source: 'constraint',
          name: 'fk',
          column: 'project_id',
          columns: [
            { column: 'tenant_id', referencedColumn: 'tenant_id' },
            { column: 'project_id', referencedColumn: 'id' },
          ],
          referencedSchema: 'public',
          referencedTable: 'project',
        },
        { tenant_id: 't1', project_id: '' },
        'project_id',
      ),
    ).toEqual({ tenant_id: 't1' })
  })
})

describe('formatForeignKeyOptionValue', () => {
  it('stringifies primitive values', () => {
    expect(formatForeignKeyOptionValue(42)).toBe('42')
    expect(formatForeignKeyOptionValue('abc')).toBe('abc')
  })
})
