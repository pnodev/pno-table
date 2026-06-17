import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { RowField } from '#/components/browse/RowField'
import { Button } from '#/components/ui/button'
import { FormAlert, FormGrid, FormGridItem } from '#/components/ui/form-layout'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetForm,
  SheetFormBody,
  SheetFormFooter,
  SheetFormHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import type { ColumnInfo, ForeignKeyInfo } from '#/lib/pg/catalog-types'
import {
  cellValueToFieldValue,
  getColumnFieldKind,
} from '#/lib/pg/column-field'
import {
  generateMissingFieldValues,
  listGeneratableColumns,
} from '#/lib/pg/generate-field-value'
import { createTableRow, saveTableRow } from '#/server/browse'

type RowFormSheetProps = {
  open: boolean
  mode: 'insert' | 'edit'
  connectionId: string
  database: string
  schema: string
  table: string
  columns: ColumnInfo[]
  foreignKeys: ForeignKeyInfo[]
  initialRow?: Record<string, unknown>
  primaryKey?: Record<string, unknown>
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}

function fieldGridSpan(column: ColumnInfo) {
  const kind = getColumnFieldKind(column)
  return kind === 'json' || kind === 'text' ? 'wide' : 'default'
}

export function RowFormSheet({
  open,
  mode,
  connectionId,
  database,
  schema,
  table,
  columns,
  foreignKeys,
  initialRow,
  primaryKey,
  onOpenChange,
  onSaved,
}: RowFormSheetProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    setValues(
      Object.fromEntries(
        columns.map((column) => [
          column.name,
          mode === 'edit' && initialRow
            ? cellValueToFieldValue(column, initialRow[column.name])
            : '',
        ]),
      ),
    )
  }, [open, mode, columns, initialRow])

  const generatableColumns = listGeneratableColumns(columns, mode)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (mode === 'insert') {
        await createTableRow({
          data: {
            connectionId,
            database,
            schema,
            table,
            values,
          },
        })
      } else {
        if (!primaryKey) {
          throw new Error('Primary key is required to update a row')
        }

        await saveTableRow({
          data: {
            connectionId,
            database,
            schema,
            table,
            primaryKey,
            values,
          },
        })
      }

      onOpenChange(false)
      await onSaved()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save row',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="wide" padding="none">
        <SheetForm onSubmit={handleSubmit}>
          <SheetFormHeader>
            <SheetTitle>
              {mode === 'insert' ? 'Add row' : 'Edit row'}
            </SheetTitle>
            <SheetDescription>
              {schema}.{table}
              {mode === 'edit'
                ? ' · Primary key columns are read-only.'
                : ' · Leave auto-generated columns empty to use database defaults.'}
            </SheetDescription>
          </SheetFormHeader>

          <SheetFormBody>
            <FormGrid>
              {columns.map((column) => (
                <FormGridItem key={column.name} span={fieldGridSpan(column)}>
                  <RowField
                    column={column}
                    columns={columns}
                    mode={mode}
                    fieldId={`row-field-${column.name}`}
                    value={values[column.name] ?? ''}
                    readOnly={mode === 'edit' && column.isPrimaryKey}
                    foreignKeys={foreignKeys}
                    relationValues={values}
                    connectionId={connectionId}
                    database={database}
                    schema={schema}
                    table={table}
                    onChange={(nextValue) =>
                      setValues((current) => ({
                        ...current,
                        [column.name]: nextValue,
                      }))
                    }
                    onRelationValuesChange={(nextValues) =>
                      setValues((current) => ({
                        ...current,
                        ...nextValues,
                      }))
                    }
                  />
                </FormGridItem>
              ))}
            </FormGrid>

            {error ? <FormAlert className="mt-5">{error}</FormAlert> : null}
          </SheetFormBody>

          <SheetFormFooter>
            {generatableColumns.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                disabled={saving}
                onClick={() =>
                  setValues((current) =>
                    generateMissingFieldValues(current, columns, mode),
                  )
                }
              >
                Generate
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Saving...
                </>
              ) : mode === 'insert' ? (
                'Insert row'
              ) : (
                'Save changes'
              )}
            </Button>
          </SheetFormFooter>
        </SheetForm>
      </SheetContent>
    </Sheet>
  )
}
