import { describe, expect, it } from 'vitest'

import type { ColumnInfo } from '#/lib/pg/catalog-types'
import {
  cellValueToFieldValue,
  getColumnFieldKind,
} from '#/lib/pg/column-field'

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

describe('getColumnFieldKind', () => {
  it('maps postgres types to field kinds', () => {
    expect(getColumnFieldKind(column({ dataType: 'boolean' }))).toBe('boolean')
    expect(getColumnFieldKind(column({ dataType: 'integer' }))).toBe('integer')
    expect(getColumnFieldKind(column({ dataType: 'date' }))).toBe('date')
    expect(
      getColumnFieldKind(column({ dataType: 'timestamp with time zone' })),
    ).toBe('datetime')
    expect(getColumnFieldKind(column({ dataType: 'jsonb' }))).toBe('json')
  })
})

describe('cellValueToFieldValue', () => {
  it('formats booleans for select inputs', () => {
    expect(cellValueToFieldValue(column({ dataType: 'boolean' }), true)).toBe(
      'true',
    )
  })

  it('formats dates for date inputs', () => {
    expect(
      cellValueToFieldValue(
        column({ dataType: 'date' }),
        '2024-03-15T00:00:00.000Z',
      ),
    ).toBe('2024-03-15')
  })
})
