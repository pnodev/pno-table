import { LoaderCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { Input } from '#/components/ui/input'
import type { ColumnRelation, ForeignKeyOption } from '#/lib/pg/catalog-types'
import {
  buildRelationFilterValues,
  buildRelationSelectedValues,
  isCompositeRelation,
  optionLabelForRelationValue,
  relationReferenceLabel,
} from '#/lib/pg/foreign-keys'
import { fetchForeignKeyOptions } from '#/server/browse'

type RelationFieldProps = {
  connectionId: string
  database: string
  schema: string
  table: string
  relation: ColumnRelation
  relationValues: Record<string, string>
  value: string
  disabled?: boolean
  fieldId: string
  onChange: (value: string) => void
  onRelationValuesChange: (values: Record<string, string>) => void
}

export function RelationField({
  connectionId,
  database,
  schema,
  table,
  relation,
  relationValues,
  value,
  disabled = false,
  fieldId,
  onChange,
  onRelationValuesChange,
}: RelationFieldProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<ForeignKeyOption[]>([])
  const [labelColumn, setLabelColumn] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const composite = isCompositeRelation(relation)
  const filterValues = buildRelationFilterValues(
    relation,
    relationValues,
    relation.column,
  )
  const selectedValues = buildRelationSelectedValues(relation, relationValues)
  const filterValuesKey = JSON.stringify(filterValues)
  const selectedValuesKey = JSON.stringify(selectedValues)
  const selectedLabel = optionLabelForRelationValue(options, relation, relationValues)

  useEffect(() => {
    if (!open) {
      setSearch(selectedLabel ?? value)
    }
  }, [open, selectedLabel, value])

  useEffect(() => {
    if (disabled) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      setError(null)

      void fetchForeignKeyOptions({
        data: {
          connectionId,
          database,
          schema,
          table,
          referencedSchema: relation.referencedSchema,
          referencedTable: relation.referencedTable,
          columns: relation.columns,
          activeColumn: relation.column,
          search: open ? search : '',
          selectedValues:
            Object.keys(selectedValues).length > 0 ? selectedValues : undefined,
          filterValues:
            Object.keys(filterValues).length > 0 ? filterValues : undefined,
        },
      })
        .then((result) => {
          if (requestId !== requestIdRef.current) {
            return
          }

          setOptions(result.options)
          setLabelColumn(result.labelColumn)
        })
        .catch((loadError) => {
          if (requestId !== requestIdRef.current) {
            return
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load related rows',
          )
        })
        .finally(() => {
          if (requestId === requestIdRef.current) {
            setLoading(false)
          }
        })
    }, open ? 200 : 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    connectionId,
    database,
    disabled,
    filterValuesKey,
    open,
    relation.column,
    relation.columns,
    relation.referencedSchema,
    relation.referencedTable,
    schema,
    search,
    selectedValuesKey,
    table,
    value,
  ])

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  const handleSelect = (option: ForeignKeyOption) => {
    if (composite) {
      onRelationValuesChange(option.values)
    } else {
      onChange(option.value)
    }

    setOpen(false)
  }

  const handleInputBlur = () => {
    window.setTimeout(() => {
      if (!rootRef.current?.contains(document.activeElement)) {
        setOpen(false)
      }
    }, 0)
  }

  const referenceLabel = relationReferenceLabel(relation)
  const showManualValue =
    !composite &&
    open &&
    search.trim() !== '' &&
    !options.some((option) => option.value === search.trim())

  return (
    <div ref={rootRef} className="relation-field">
      <Input
        id={fieldId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={open ? search : selectedLabel ?? value}
        readOnly={disabled}
        placeholder={`Search ${referenceLabel}...`}
        className="field-mono"
        onFocus={() => {
          if (!disabled) {
            setOpen(true)
          }
        }}
        onBlur={handleInputBlur}
        onChange={(event) => {
          setSearch(event.target.value)
          setOpen(true)
        }}
      />

      {open && !disabled ? (
        <div id={listId} role="listbox" className="relation-field-list">
          {composite ? (
            <p className="relation-field-meta">
              Composite reference · selecting updates{' '}
              {relation.columns.map((mapping) => mapping.column).join(', ')}
            </p>
          ) : labelColumn ? (
            <p className="relation-field-meta">
              Showing {relation.columns[0]?.referencedColumn}
              {labelColumn !== relation.columns[0]?.referencedColumn
                ? ` · label: ${labelColumn}`
                : ''}
            </p>
          ) : null}

          {loading ? (
            <div className="relation-field-status">
              <LoaderCircle className="size-3.5 animate-spin" />
              Loading...
            </div>
          ) : null}

          {error ? <p className="relation-field-error">{error}</p> : null}

          {!loading && !error && options.length === 0 ? (
            <p className="relation-field-status">No matching rows.</p>
          ) : null}

          {options.map((option) => {
            const isSelected = composite
              ? relation.columns.every(
                  (mapping) =>
                    option.values[mapping.column] ===
                    relationValues[mapping.column]?.trim(),
                )
              : option.value === value

            const optionKey = composite
              ? JSON.stringify(option.values)
              : option.value

            return (
              <button
                key={optionKey}
                type="button"
                role="option"
                aria-selected={isSelected}
                className="relation-field-option"
                data-selected={isSelected ? '' : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                <span className="relation-field-option-label">{option.label}</span>
                {composite ? (
                  <span className="relation-field-option-value">
                    {relation.columns
                      .map(
                        (mapping) =>
                          `${mapping.column}=${option.values[mapping.column] ?? ''}`,
                      )
                      .join(' · ')}
                  </span>
                ) : option.label !== option.value ? (
                  <span className="relation-field-option-value">{option.value}</span>
                ) : null}
              </button>
            )
          })}

          {showManualValue ? (
            <button
              type="button"
              className="relation-field-option relation-field-option-manual"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(search.trim())
                setOpen(false)
              }}
            >
              Use value{' '}
              <span className="relation-field-option-value">{search.trim()}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
