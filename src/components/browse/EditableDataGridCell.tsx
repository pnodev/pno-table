import { LoaderCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { DataGridCell } from '#/components/browse/DataGridCell'
import { Input } from '#/components/ui/input'
import { NativeSelect } from '#/components/ui/form-layout'
import { Textarea } from '#/components/ui/textarea'
import { TableCell } from '#/components/ui/table'
import type { ColumnInfo, LinkableRelation } from '#/lib/pg/catalog-types'
import {
  cellValueToFieldValue,
  getColumnFieldKind,
  inputStepForKind,
  isExplicitNullValue,
} from '#/lib/pg/column-field'
import { saveTableRow } from '#/server/browse'
import { cn } from '#/lib/utils'

type EditableDataGridCellProps = {
  column: ColumnInfo
  editable: boolean
  row: Record<string, unknown>
  primaryKey: Record<string, unknown>
  connectionId: string
  database: string
  schema: string
  table: string
  pageSize: number
  rawValue: unknown
  display: string
  title: string
  hasRelationLabel: boolean
  linkable?: LinkableRelation
  onPreviewUrl: (url: string) => void
  onSaved: () => Promise<void>
}

export function EditableDataGridCell({
  column,
  editable,
  row,
  primaryKey,
  connectionId,
  database,
  schema,
  table,
  pageSize,
  rawValue,
  display,
  title,
  hasRelationLabel,
  linkable,
  onPreviewUrl,
  onSaved,
}: EditableDataGridCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const initialValueRef = useRef('')
  const skipBlurSaveRef = useRef(false)

  const kind = getColumnFieldKind(column)
  const isMultiline = kind === 'json' || kind === 'text'
  const isExplicitNull = isExplicitNullValue(draft)

  const startEditing = () => {
    if (!editable || saving) {
      return
    }

    const value = cellValueToFieldValue(column, row[column.name])
    initialValueRef.current = value
    setDraft(value)
    setEditing(true)
  }

  const cancel = () => {
    skipBlurSaveRef.current = true
    setEditing(false)
    setDraft('')
  }

  const save = async () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false
      return
    }

    if (!editing || saving) {
      return
    }

    if (draft === initialValueRef.current) {
      cancel()
      return
    }

    setSaving(true)
    const toastId = toast.loading(`Saving ${column.name}…`)

    try {
      await saveTableRow({
        data: {
          connectionId,
          database,
          schema,
          table,
          primaryKey,
          values: { [column.name]: draft },
        },
      })
      setEditing(false)
      await onSaved()
      toast.success(`Updated ${column.name}`, { id: toastId })
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Failed to save cell'
      toast.error(message, { id: toastId })
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      skipBlurSaveRef.current = true
      cancel()
      return
    }

    if (event.key === 'Enter' && !isMultiline) {
      event.preventDefault()
      void save()
      return
    }

    if (event.key === 'Enter' && isMultiline && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void save()
    }
  }

  const renderEditor = () => {
    const monoClassName = 'inline-cell-input field-mono'
    const sharedProps = {
      autoFocus: true,
      disabled: saving,
      className: monoClassName,
      onKeyDown: handleKeyDown,
      onBlur: () => void save(),
    }

    if (kind === 'boolean') {
      return (
        <NativeSelect
          {...sharedProps}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        >
          {column.isNullable ? <option value="">NULL</option> : null}
          {!column.isNullable && draft === '' ? (
            <option value="" disabled>
              Select...
            </option>
          ) : null}
          <option value="true">true</option>
          <option value="false">false</option>
        </NativeSelect>
      )
    }

    if (isMultiline) {
      return (
        <Textarea
          {...sharedProps}
          value={isExplicitNull ? '' : draft}
          rows={kind === 'json' ? 5 : 3}
          placeholder={
            kind === 'json' ? '{\n  "key": "value"\n}' : undefined
          }
          onChange={(event) => setDraft(event.target.value)}
        />
      )
    }

    if (kind === 'date') {
      return (
        <Input
          {...sharedProps}
          type="date"
          value={isExplicitNull ? '' : draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )
    }

    if (kind === 'time') {
      return (
        <Input
          {...sharedProps}
          type="time"
          step="1"
          value={isExplicitNull ? '' : draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )
    }

    if (kind === 'datetime') {
      return (
        <Input
          {...sharedProps}
          type="datetime-local"
          step="1"
          value={isExplicitNull ? '' : draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )
    }

    if (kind === 'integer' || kind === 'number') {
      return (
        <Input
          {...sharedProps}
          type="number"
          inputMode={kind === 'integer' ? 'numeric' : 'decimal'}
          step={inputStepForKind(kind)}
          value={isExplicitNull ? '' : draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )
    }

    return (
      <Input
        {...sharedProps}
        type="text"
        value={isExplicitNull ? '' : draft}
        placeholder={
          column.dataType.toLowerCase() === 'uuid'
            ? '00000000-0000-0000-0000-000000000000'
            : undefined
        }
        onChange={(event) => setDraft(event.target.value)}
      />
    )
  }

  const cellTitle = editable && !editing ? `${title}\nDouble-click to edit` : title

  return (
    <TableCell
      className={cn(
        'text-xs',
        editing
          ? 'max-w-md whitespace-normal p-1 align-top'
          : 'max-w-xs truncate',
        editable && !editing && 'editable-cell',
        saving && 'opacity-60',
      )}
      title={cellTitle}
      onDoubleClick={startEditing}
    >
      {editing ? (
        <div className="inline-cell-editor">
          {renderEditor()}
          {saving ? (
            <div className="inline-cell-saving" aria-hidden>
              <LoaderCircle className="size-3.5 animate-spin text-brand" />
            </div>
          ) : null}
        </div>
      ) : (
        <DataGridCell
          connectionId={connectionId}
          database={database}
          pageSize={pageSize}
          rawValue={rawValue}
          display={display}
          title={title}
          hasRelationLabel={hasRelationLabel}
          linkable={linkable}
          onPreviewUrl={onPreviewUrl}
        />
      )}
    </TableCell>
  )
}
