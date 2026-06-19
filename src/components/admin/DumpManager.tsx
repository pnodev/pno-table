import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
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
import { Input } from '#/components/ui/input'
import { Switch } from '#/components/ui/switch'
import type { DatabaseDetails } from '#/lib/pg/catalog-types'
import { formatAppError } from '#/lib/format-error'
import {
  exportServerDatabaseDump,
  importServerDatabaseDump,
} from '#/server/dumps'

type DumpManagerProps = {
  connectionId: string
  readOnly: boolean
  initialDatabases: DatabaseDetails[]
}

const defaultExportOptions = {
  schemaOnly: false,
  dataOnly: false,
  noOwner: true,
  noPrivileges: true,
}

const defaultImportOptions = {
  singleTransaction: true,
  onErrorStop: true,
}

export function DumpManager({
  connectionId,
  readOnly,
  initialDatabases,
}: DumpManagerProps) {
  const [databases] = useState(initialDatabases)
  const [exportDatabase, setExportDatabase] = useState(
    initialDatabases[0]?.name ?? '',
  )
  const [importDatabase, setImportDatabase] = useState(
    initialDatabases[0]?.name ?? '',
  )
  const [exportOptions, setExportOptions] = useState(defaultExportOptions)
  const [importOptions, setImportOptions] = useState(defaultImportOptions)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    if (!exportDatabase) {
      setError('Select a database to export')
      return
    }

    setExporting(true)
    setError(null)

    try {
      const result = await exportServerDatabaseDump({
        data: {
          connectionId,
          database: exportDatabase,
          options: exportOptions,
        },
      })

      downloadTextFile(result.filename, result.sql)
      toast.success(`Exported "${exportDatabase}"`)
    } catch (exportError) {
      setError(formatAppError(exportError, 'Failed to export database'))
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    if (!importDatabase) {
      setError('Select a target database')
      return
    }

    if (!selectedFile) {
      setError('Choose a .sql file to import')
      return
    }

    setImporting(true)
    setError(null)

    try {
      const sql = await selectedFile.text()

      await importServerDatabaseDump({
        data: {
          connectionId,
          database: importDatabase,
          sql,
          options: importOptions,
        },
      })

      toast.success(`Imported into "${importDatabase}"`)
      setSelectedFile(null)
      setConfirmImportOpen(false)
    } catch (importError) {
      setError(formatAppError(importError, 'Failed to import database dump'))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Dumps</h1>
        <p className="text-sm text-muted-foreground">
          Export a database to a plain SQL file or import an existing dump with
          pg_dump and psql.
        </p>
      </div>

      {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-medium text-foreground">Export</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Download a plain SQL dump of a database.
          </p>

          <FormGrid>
            <FormGridItem span="wide">
              <Field>
                <FieldLabel htmlFor="export-database">Database</FieldLabel>
                <NativeSelect
                  id="export-database"
                  value={exportDatabase}
                  onChange={(event) => setExportDatabase(event.target.value)}
                >
                  {databases.map((database) => (
                    <option key={database.name} value={database.name}>
                      {database.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </FormGridItem>

            <FormGridItem span="wide">
              <DumpOption
                id="export-schema-only"
                label="Schema only"
                hint="Omit table data."
                checked={exportOptions.schemaOnly}
                disabled={exportOptions.dataOnly}
                onCheckedChange={(checked) =>
                  setExportOptions((current) => ({
                    ...current,
                    schemaOnly: checked,
                  }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <DumpOption
                id="export-data-only"
                label="Data only"
                hint="Omit CREATE statements."
                checked={exportOptions.dataOnly}
                disabled={exportOptions.schemaOnly}
                onCheckedChange={(checked) =>
                  setExportOptions((current) => ({
                    ...current,
                    dataOnly: checked,
                  }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <DumpOption
                id="export-no-owner"
                label="No owner"
                hint="Skip ownership commands in the dump."
                checked={exportOptions.noOwner}
                onCheckedChange={(checked) =>
                  setExportOptions((current) => ({
                    ...current,
                    noOwner: checked,
                  }))
                }
              />
            </FormGridItem>

            <FormGridItem span="wide">
              <DumpOption
                id="export-no-privileges"
                label="No privileges"
                hint="Skip GRANT and REVOKE statements."
                checked={exportOptions.noPrivileges}
                onCheckedChange={(checked) =>
                  setExportOptions((current) => ({
                    ...current,
                    noPrivileges: checked,
                  }))
                }
              />
            </FormGridItem>
          </FormGrid>

          <div className="mt-5">
            <Button
              disabled={exporting || !exportDatabase}
              onClick={() => void handleExport()}
            >
              {exporting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Export SQL'
              )}
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-lg font-medium text-foreground">Import</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Run a plain SQL dump against a target database.
          </p>

          {readOnly ? (
            <FormAlert>
              This connection is read-only. Import is disabled.
            </FormAlert>
          ) : (
            <>
              <FormGrid>
                <FormGridItem span="wide">
                  <Field>
                    <FieldLabel htmlFor="import-database">
                      Target database
                    </FieldLabel>
                    <NativeSelect
                      id="import-database"
                      value={importDatabase}
                      onChange={(event) =>
                        setImportDatabase(event.target.value)
                      }
                    >
                      {databases.map((database) => (
                        <option key={database.name} value={database.name}>
                          {database.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </FormGridItem>

                <FormGridItem span="wide">
                  <Field>
                    <FieldLabel htmlFor="import-file">SQL file</FieldLabel>
                    <Input
                      id="import-file"
                      type="file"
                      accept=".sql,text/plain,application/sql"
                      onChange={(event) => {
                        setSelectedFile(event.target.files?.[0] ?? null)
                      }}
                    />
                    <FieldHint>
                      Plain SQL dumps up to 50 MB. Custom or directory formats
                      are not supported.
                    </FieldHint>
                  </Field>
                </FormGridItem>

                <FormGridItem span="wide">
                  <DumpOption
                    id="import-single-transaction"
                    label="Single transaction"
                    hint="Roll back the entire import if any statement fails."
                    checked={importOptions.singleTransaction}
                    onCheckedChange={(checked) =>
                      setImportOptions((current) => ({
                        ...current,
                        singleTransaction: checked,
                      }))
                    }
                  />
                </FormGridItem>

                <FormGridItem span="wide">
                  <DumpOption
                    id="import-on-error-stop"
                    label="Stop on error"
                    hint="Abort as soon as psql hits a failed statement."
                    checked={importOptions.onErrorStop}
                    onCheckedChange={(checked) =>
                      setImportOptions((current) => ({
                        ...current,
                        onErrorStop: checked,
                      }))
                    }
                  />
                </FormGridItem>
              </FormGrid>

              <div className="mt-5">
                <Button
                  disabled={importing || !importDatabase || !selectedFile}
                  onClick={() => setConfirmImportOpen(true)}
                >
                  Import SQL
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import SQL dump?</AlertDialogTitle>
            <AlertDialogDescription>
              This will execute{' '}
              <span className="font-mono">{selectedFile?.name}</span> against{' '}
              <span className="font-mono">{importDatabase}</span>. Existing
              objects may be altered or replaced depending on the dump
              contents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={importing}
              onClick={(event) => {
                event.preventDefault()
                void handleImport()
              }}
            >
              {importing ? 'Importing...' : 'Import dump'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

type DumpOptionProps = {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}

function DumpOption({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: DumpOptionProps) {
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

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/sql;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
