import { describe, expect, it, vi } from 'vitest'

import type { ColumnInfo } from '#/lib/pg/catalog-types'
import {
  generateFieldValue,
  generateMissingFieldValues,
  supportsClientGeneration,
} from '#/lib/pg/generate-field-value'

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

describe('supportsClientGeneration', () => {
  it('supports uuid and timestamp columns', () => {
    expect(supportsClientGeneration(column({ dataType: 'uuid' }), 'insert')).toBe(
      true,
    )
    expect(
      supportsClientGeneration(
        column({ dataType: 'timestamp with time zone' }),
        'insert',
      ),
    ).toBe(true)
  })

  it('skips primary keys on update', () => {
    expect(
      supportsClientGeneration(
        column({ dataType: 'uuid', isPrimaryKey: true }),
        'edit',
      ),
    ).toBe(false)
  })
})

describe('generateFieldValue', () => {
  it('generates uuid values', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-2222-4333-8444-555555555555',
    })

    expect(generateFieldValue(column({ dataType: 'uuid' }))).toBe(
      '11111111-2222-4333-8444-555555555555',
    )

    vi.unstubAllGlobals()
  })
})

describe('generateMissingFieldValues', () => {
  it('fills empty uuid fields on insert', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-2222-4333-8444-555555555555',
    })

    const result = generateMissingFieldValues(
      { id: '' },
      [column({ name: 'id', dataType: 'uuid' })],
      'insert',
    )

    expect(result.id).toBe('11111111-2222-4333-8444-555555555555')

    vi.unstubAllGlobals()
  })

  it('skips db-generated defaults', () => {
    const columns = [
      column({
        name: 'id',
        dataType: 'uuid',
        defaultValue: 'gen_random_uuid()',
      }),
    ]

    expect(
      generateMissingFieldValues({ id: '' }, columns, 'insert'),
    ).toEqual({ id: '' })
  })
})
