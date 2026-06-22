import { Link } from '@tanstack/react-router'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import {
  Field,
  FieldHint,
  FieldLabel,
  FormAlert,
  FormGrid,
  FormGridItem,
  NativeSelect,
} from '#/components/ui/form-layout'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import type { DatabaseDetails } from '#/lib/pg/catalog-types'
import { formatAppError } from '#/lib/format-error'
import type {
  ImportCatalogSchema,
  ImportPreview,
} from '#/lib/pg/import'
import type {
  ImportRunOptions,
  ImportSelection,
  ImportTableRef,
} from '#/lib/pg/import-schemas'
import {
  listImportSourceCatalog,
  previewImport,
  runDatabaseImport,
  setImportSourceDatabase,
  startImportSession,
} from '#/server/import'

type ImportWizardProps = {
  connectionId: string
  readOnly: boolean
  initialDatabases: DatabaseDetails[]
}

type WizardStep = 'source' | 'select' | 'target' | 'review'

const stepOrder: WizardStep[] = ['source', 'select', 'target', 'review']

const stepLabels: Record<WizardStep, string> = {
  source: 'Source',
  select: 'Select',
  target: 'Target',
  review: 'Review',
}

const defaultOptions: ImportRunOptions = {
  schemaOnly: false,
  dataOnly: false,
  noOwner: true,
  noPrivileges: true,
  singleTransaction: true,
  onErrorStop: true,
  conflictMode: 'fail',
}

export function ImportWizard({
  connectionId,
  readOnly,
  initialDatabases,
}: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('source')
  const [connectionString, setConnectionString] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sourceDatabase, setSourceDatabase] = useState('')
  const [sourceDatabases, setSourceDatabases] = useState<string[]>([])
  const [poolerWarning, setPoolerWarning] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<ImportCatalogSchema[]>([])
  const [importEntireDatabase, setImportEntireDatabase] = useState(true)
  const [selectedSchemas, setSelectedSchemas] = useState<Set<string>>(
    () => new Set(),
  )
  const [selectedTables, setSelectedTables] = useState<Set<string>>(
    () => new Set(),
  )
  const [targetDatabase, setTargetDatabase] = useState(
    initialDatabases[0]?.name ?? '',
  )
  const [options, setOptions] = useState<ImportRunOptions>(defaultOptions)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sourceVersion, setSourceVersion] = useState<string | null>(null)

  const selection = useMemo(
    (): ImportSelection => buildSelection(
      importEntireDatabase,
      selectedSchemas,
      selectedTables,
    ),
    [importEntireDatabase, selectedSchemas, selectedTables],
  )

  const selectionSummary = useMemo(
    () => describeSelection(selection, catalog),
    [selection, catalog],
  )

  useEffect(() => {
    if (step !== 'select' || !sessionId) {
      return
    }

    setLoading(true)
    setError(null)

    void listImportSourceCatalog({ data: { sessionId } })
      .then((rows) => {
        setCatalog(rows)
      })
      .catch((catalogError) => {
        setError(formatAppError(catalogError, 'Failed to load source catalog'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [step, sessionId])

  useEffect(() => {
    if (step !== 'review' || !sessionId || !targetDatabase) {
      return
    }

    setLoading(true)
    setError(null)

    void previewImport({
      data: {
        sessionId,
        connectionId,
        targetDatabase,
        selection,
        options,
      },
    })
      .then((result) => {
        setPreview(result)
      })
      .catch((previewError) => {
        setError(formatAppError(previewError, 'Failed to preview import'))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [step, sessionId, connectionId, targetDatabase, selection, options])

  const handleConnectSource = async () => {
    setError(null)
    setLoading(true)

    try {
      const result = await startImportSession({
        data: { connectionString: connectionString.trim() },
      })

      setSessionId(result.sessionId)
      setSourceDatabase(result.sourceDatabase)
      setSourceDatabases(result.databases)
      setPoolerWarning(result.poolerWarning)
      setSourceVersion(result.testResult.ok ? result.testResult.version : null)
      setStep('select')
    } catch (connectError) {
      setError(formatAppError(connectError, 'Failed to connect to source'))
    } finally {
      setLoading(false)
    }
  }

  const handleSourceDatabaseChange = async (database: string) => {
    if (!sessionId) {
      return
    }

    setError(null)
    setLoading(true)

    try {
      await setImportSourceDatabase({
        data: { sessionId, database },
      })

      setSourceDatabase(database)
      setImportEntireDatabase(true)
      setSelectedSchemas(new Set())
      setSelectedTables(new Set())
      setCatalog([])
    } catch (databaseError) {
      setError(formatAppError(databaseError, 'Failed to switch source database'))
    } finally {
      setLoading(false)
    }
  }

  const handleRunImport = async () => {
    if (!sessionId) {
      return
    }

    setRunning(true)
    setError(null)

    try {
      await runDatabaseImport({
        data: {
          sessionId,
          connectionId,
          targetDatabase,
          selection,
          options,
        },
      })

      toast.success(`Imported into "${targetDatabase}"`)
      setConfirmOpen(false)
      setStep('source')
      setSessionId(null)
      setConnectionString('')
      setCatalog([])
      setPreview(null)
      setOptions(defaultOptions)
      setImportEntireDatabase(true)
      setSelectedSchemas(new Set())
      setSelectedTables(new Set())
    } catch (importError) {
      setError(formatAppError(importError, 'Import failed'))
    } finally {
      setRunning(false)
    }
  }

  if (readOnly) {
    return (
      <div className="p-6">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Import</h1>
          <p className="text-sm text-muted-foreground">
            Copy data directly from another PostgreSQL database.
          </p>
        </div>
        <FormAlert>
          This connection is read-only. Import is disabled.
        </FormAlert>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Import</h1>
        <p className="text-sm text-muted-foreground">
          Connect to a source database, choose what to copy, and import directly
          into a target database on this connection.
        </p>
      </div>

      <WizardSteps current={step} />

      {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}
      {poolerWarning ? (
        <FormAlert variant="warning" className="mb-4">
          {poolerWarning}
        </FormAlert>
      ) : null}

      {step === 'source' ? (
        <section className="max-w-2xl rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-medium text-foreground">
            Source connection
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Paste a PostgreSQL connection string for the database you want to
            copy from. Credentials are kept in a short-lived server session and
            are not saved.
          </p>

          <FormGrid>
            <FormGridItem span="wide">
              <Field>
                <FieldLabel htmlFor="import-connection-string">
                  Connection string
                </FieldLabel>
                <Textarea
                  id="import-connection-string"
                  className="field-mono min-h-24"
                  value={connectionString}
                  onChange={(event) => setConnectionString(event.target.value)}
                  placeholder="postgresql://user:password@host:5432/mydb?sslmode=require"
                />
                <FieldHint>
                  Supports postgresql:// URLs and libpq key=value strings.
                </FieldHint>
              </Field>
            </FormGridItem>
          </FormGrid>

          <div className="mt-5 flex gap-2">
            <Button
              disabled={loading || !connectionString.trim()}
              onClick={() => void handleConnectSource()}
            >
              {loading ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Test &amp; continue
                  <ChevronRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'select' ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="mb-1 text-lg font-medium text-foreground">
                What to import
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose the source database and the schemas or tables to copy.
              </p>
            </div>

            {sourceDatabases.length > 1 ? (
              <Field className="min-w-48">
                <FieldLabel htmlFor="source-database">Source database</FieldLabel>
                <NativeSelect
                  id="source-database"
                  value={sourceDatabase}
                  disabled={loading}
                  onChange={(event) =>
                    void handleSourceDatabaseChange(event.target.value)
                  }
                >
                  {sourceDatabases.map((database) => (
                    <option key={database} value={database}>
                      {database}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : (
              <p className="font-mono text-sm text-muted-foreground">
                Source: {sourceDatabase}
              </p>
            )}
          </div>

          {sourceVersion ? (
            <p className="mb-4 truncate text-xs text-muted-foreground">
              {sourceVersion}
            </p>
          ) : null}

          <ImportOption
            id="import-entire-database"
            label="Entire database"
            hint="Copy all user schemas and objects from the source database."
            checked={importEntireDatabase}
            onCheckedChange={(checked) => {
              setImportEntireDatabase(checked)
              if (checked) {
                setSelectedSchemas(new Set())
                setSelectedTables(new Set())
              }
            }}
          />

          {!importEntireDatabase ? (
            <div className="mt-4 rounded-md border border-border">
              {loading ? (
                <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading catalog...
                </div>
              ) : catalog.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No user schemas found on the source database.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {catalog.map((schema) => (
                    <CatalogSchemaRow
                      key={schema.name}
                      schema={schema}
                      selectedSchemas={selectedSchemas}
                      selectedTables={selectedTables}
                      onToggleSchema={(schemaName, checked) => {
                        setSelectedSchemas((current) => {
                          const next = new Set(current)
                          if (checked) {
                            next.add(schemaName)
                          } else {
                            next.delete(schemaName)
                          }
                          return next
                        })
                        setSelectedTables((current) => {
                          const next = new Set(current)
                          for (const relation of schema.relations) {
                            next.delete(tableKey(relation))
                          }
                          return next
                        })
                      }}
                      onToggleTable={(table, checked) => {
                        setSelectedTables((current) => {
                          const next = new Set(current)
                          const key = tableKey(table)
                          if (checked) {
                            next.add(key)
                          } else {
                            next.delete(key)
                          }
                          return next
                        })
                        setSelectedSchemas((current) => {
                          const next = new Set(current)
                          next.delete(table.schema)
                          return next
                        })
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="mt-5 flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep('source')
                setSessionId(null)
              }}
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button
              disabled={loading || !canContinueFromSelect(selection)}
              onClick={() => setStep('target')}
            >
              Continue
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'target' ? (
        <section className="max-w-2xl rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-medium text-foreground">
            Target &amp; options
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Import into a database on this connection ({selectionSummary}).
          </p>

          <FormGrid>
            <FormGridItem span="wide">
              <Field>
                <FieldLabel htmlFor="target-database">Target database</FieldLabel>
                <NativeSelect
                  id="target-database"
                  value={targetDatabase}
                  onChange={(event) => setTargetDatabase(event.target.value)}
                >
                  {initialDatabases.map((database) => (
                    <option key={database.name} value={database.name}>
                      {database.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldHint>
                  Use an empty database for the safest import.{' '}
                  <Link
                    to="/connect/$connectionId/databases"
                    params={{ connectionId }}
                    className="text-brand hover:underline"
                  >
                    Create one
                  </Link>{' '}
                  if needed.
                </FieldHint>
              </Field>
            </FormGridItem>

            <FormGridItem span="wide">
              <ImportOption
                id="import-schema-only"
                label="Schema only"
                hint="Omit table data."
                checked={options.schemaOnly}
                disabled={options.dataOnly}
                onCheckedChange={(checked) =>
                  setOptions((current) => ({ ...current, schemaOnly: checked }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <ImportOption
                id="import-data-only"
                label="Data only"
                hint="Omit CREATE statements."
                checked={options.dataOnly}
                disabled={options.schemaOnly}
                onCheckedChange={(checked) =>
                  setOptions((current) => ({ ...current, dataOnly: checked }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <ImportOption
                id="import-no-owner"
                label="No owner"
                hint="Skip ownership commands in the dump."
                checked={options.noOwner}
                onCheckedChange={(checked) =>
                  setOptions((current) => ({ ...current, noOwner: checked }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <ImportOption
                id="import-no-privileges"
                label="No privileges"
                hint="Skip GRANT and REVOKE statements."
                checked={options.noPrivileges}
                onCheckedChange={(checked) =>
                  setOptions((current) => ({
                    ...current,
                    noPrivileges: checked,
                  }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <ImportOption
                id="import-single-transaction"
                label="Single transaction"
                hint="Roll back the entire import if any statement fails."
                checked={options.singleTransaction}
                onCheckedChange={(checked) =>
                  setOptions((current) => ({
                    ...current,
                    singleTransaction: checked,
                  }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <Field>
                <FieldLabel htmlFor="import-conflict-mode">
                  If objects already exist
                </FieldLabel>
                <NativeSelect
                  id="import-conflict-mode"
                  value={options.conflictMode}
                  onChange={(event) =>
                    setOptions((current) => ({
                      ...current,
                      conflictMode: event.target.value as 'fail' | 'replace',
                    }))
                  }
                >
                  <option value="fail">Stop with an error</option>
                  <option value="replace">
                    Drop selected objects first, then import
                  </option>
                </NativeSelect>
              </Field>
            </FormGridItem>
          </FormGrid>

          <div className="mt-5 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep('select')}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button disabled={!targetDatabase} onClick={() => setStep('review')}>
              Continue
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'review' ? (
        <section className="max-w-2xl rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-medium text-foreground">
            Review &amp; import
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Confirm the import details before running pg_dump and psql on the
            server.
          </p>

          <dl className="space-y-3 text-sm">
            <ReviewRow label="Source database" value={sourceDatabase} mono />
            <ReviewRow label="Target database" value={targetDatabase} mono />
            <ReviewRow label="Selection" value={selectionSummary} />
            <ReviewRow
              label="Conflict handling"
              value={
                options.conflictMode === 'fail'
                  ? 'Stop if objects exist'
                  : 'Drop selected objects first'
              }
            />
          </dl>

          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Checking target...
            </div>
          ) : null}

          {preview?.collisions.length ? (
            <FormAlert variant="warning" className="mt-4">
              Existing objects on the target: {preview.collisions.join('; ')}
            </FormAlert>
          ) : null}

          {preview?.warnings.length ? (
            <FormAlert variant="warning" className="mt-4">
              {preview.warnings.join(' ')}
            </FormAlert>
          ) : null}

          <div className="mt-5 flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep('target')}>
              <ChevronLeft className="size-4" />
              Back
            </Button>
            <Button
              disabled={loading || running}
              onClick={() => setConfirmOpen(true)}
            >
              Run import
            </Button>
          </div>
        </section>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run database import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will copy {selectionSummary} from{' '}
              <span className="font-mono">{sourceDatabase}</span> into{' '}
              <span className="font-mono">{targetDatabase}</span>.
              {options.conflictMode === 'replace'
                ? ' Selected objects on the target will be dropped first.'
                : ' The import will stop if conflicting objects already exist.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={running}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={running}
              onClick={(event) => {
                event.preventDefault()
                void handleRunImport()
              }}
            >
              {running ? 'Importing...' : 'Start import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function WizardSteps({ current }: { current: WizardStep }) {
  const currentIndex = stepOrder.indexOf(current)

  return (
    <ol className="mb-6 flex flex-wrap gap-2">
      {stepOrder.map((step, index) => {
        const done = index < currentIndex
        const active = step === current

        return (
          <li
            key={step}
            className={[
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
              active
                ? 'border-brand bg-brand-subtle text-foreground'
                : done
                  ? 'border-border bg-muted text-foreground'
                  : 'border-border bg-card text-muted-foreground',
            ].join(' ')}
          >
            <span
              className={[
                'flex size-5 items-center justify-center rounded-full text-xs font-medium',
                active || done
                  ? 'bg-brand text-white'
                  : 'bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {done ? <Check className="size-3" /> : index + 1}
            </span>
            {stepLabels[step]}
          </li>
        )
      })}
    </ol>
  )
}

type CatalogSchemaRowProps = {
  schema: ImportCatalogSchema
  selectedSchemas: Set<string>
  selectedTables: Set<string>
  onToggleSchema: (schema: string, checked: boolean) => void
  onToggleTable: (table: ImportTableRef, checked: boolean) => void
}

function CatalogSchemaRow({
  schema,
  selectedSchemas,
  selectedTables,
  onToggleSchema,
  onToggleTable,
}: CatalogSchemaRowProps) {
  const schemaSelected = selectedSchemas.has(schema.name)
  const tableKeys = schema.relations.map((relation) => tableKey(relation))
  const selectedCount = tableKeys.filter((key) => selectedTables.has(key)).length
  const indeterminate =
    !schemaSelected && selectedCount > 0 && selectedCount < tableKeys.length

  return (
    <li>
      <label className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          className="size-4 rounded border border-border"
          checked={schemaSelected}
          ref={(element) => {
            if (element) {
              element.indeterminate = indeterminate
            }
          }}
          onChange={(event) =>
            onToggleSchema(schema.name, event.target.checked)
          }
        />
        <span className="font-medium text-foreground">{schema.name}</span>
        <span className="text-xs text-muted-foreground">
          {schema.relations.length} objects
        </span>
      </label>

      {schema.relations.length > 0 ? (
        <ul className="border-t border-border bg-muted/30">
          {schema.relations.map((relation) => {
            const key = tableKey(relation)
            const checked = schemaSelected || selectedTables.has(key)

            return (
              <li key={key}>
                <label className="flex items-center gap-3 px-4 py-2 pl-10">
                  <input
                    type="checkbox"
                    className="size-4 rounded border border-border"
                    checked={checked}
                    disabled={schemaSelected}
                    onChange={(event) =>
                      onToggleTable(relation, event.target.checked)
                    }
                  />
                  <span className="font-mono text-sm text-foreground">
                    {relation.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relation.kind}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}

type ImportOptionProps = {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

function ImportOption({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: ImportOptionProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border px-3 py-2">
      <div className="space-y-1">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldHint>{hint}</FieldHint>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

function ReviewRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-foreground' : 'text-foreground'}>
        {value}
      </dd>
    </div>
  )
}

function tableKey(table: ImportTableRef): string {
  return `${table.schema}.${table.name}`
}

function buildSelection(
  importEntireDatabase: boolean,
  selectedSchemas: Set<string>,
  selectedTables: Set<string>,
): ImportSelection {
  if (importEntireDatabase) {
    return { mode: 'database', schemas: [], tables: [] }
  }

  if (selectedSchemas.size > 0) {
    return {
      mode: 'schemas',
      schemas: [...selectedSchemas],
      tables: [],
    }
  }

  return {
    mode: 'tables',
    tables: [...selectedTables].map((key) => {
      const [schema, ...nameParts] = key.split('.')
      return { schema, name: nameParts.join('.') }
    }),
    schemas: [],
  }
}

function canContinueFromSelect(selection: ImportSelection): boolean {
  if (selection.mode === 'database') {
    return true
  }

  if (selection.mode === 'schemas') {
    return selection.schemas.length > 0
  }

  return selection.tables.length > 0
}

function describeSelection(
  selection: ImportSelection,
  catalog: ImportCatalogSchema[],
): string {
  if (selection.mode === 'database') {
    return 'entire database'
  }

  if (selection.mode === 'schemas') {
    return `${selection.schemas.length} schema${selection.schemas.length === 1 ? '' : 's'}`
  }

  return `${selection.tables.length} table${selection.tables.length === 1 ? '' : 's'} across ${countSchemasForTables(selection.tables, catalog)} schema${countSchemasForTables(selection.tables, catalog) === 1 ? '' : 's'}`
}

function countSchemasForTables(
  tables: ImportTableRef[],
  catalog: ImportCatalogSchema[],
): number {
  if (tables.length === 0) {
    return 0
  }

  const schemaNames = new Set(tables.map((table) => table.schema))

  if (catalog.length === 0) {
    return schemaNames.size
  }

  return schemaNames.size
}
