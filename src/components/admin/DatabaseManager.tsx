import { LoaderCircle, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import type { DatabaseDetails } from '#/lib/pg/catalog-types'
import {
  createDatabaseSchema,
  identifierHint,
} from '#/lib/pg/admin-schemas'
import { formatAppError } from '#/lib/format-error'
import { emitSidebarRefresh } from '#/lib/sidebar-refresh'
import {
  createServerDatabase,
  emptyServerDatabase,
  fetchDatabaseDetails,
  fetchRoleNames,
  removeServerDatabase,
  truncateServerDatabase,
} from '#/server/admin'

type CreateDatabaseSheetProps = {
  open: boolean
  connectionId: string
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}

const defaultValues = {
  name: '',
  owner: '',
  encoding: 'UTF8',
  template: '',
}

export function CreateDatabaseSheet({
  open,
  connectionId,
  onOpenChange,
  onCreated,
}: CreateDatabaseSheetProps) {
  const [values, setValues] = useState(defaultValues)
  const [roleNames, setRoleNames] = useState<string[]>([])
  const [databaseNames, setDatabaseNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setValues(defaultValues)
    setError(null)

    void Promise.all([
      fetchRoleNames({ data: { connectionId } }),
      fetchDatabaseDetails({ data: { connectionId } }),
    ])
      .then(([roles, databases]) => {
        setRoleNames(roles)
        setDatabaseNames(databases.map((database) => database.name))
      })
      .catch(() => {
        setRoleNames([])
        setDatabaseNames([])
      })
  }, [open, connectionId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const parsed = createDatabaseSchema.safeParse({
      name: values.name.trim(),
      owner: values.owner || undefined,
      encoding: values.encoding,
      template: values.template || undefined,
    })

    if (!parsed.success) {
      setError(formatAppError(parsed.error))
      return
    }

    setSaving(true)

    try {
      await createServerDatabase({
        data: {
          connectionId,
          values: parsed.data,
        },
      })

      toast.success(`Database "${parsed.data.name}" created`)
      onOpenChange(false)
      await onCreated()
      emitSidebarRefresh({ connectionId })
    } catch (submitError) {
      setError(formatAppError(submitError, 'Failed to create database'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="md" padding="none">
        <SheetForm onSubmit={(event) => void handleSubmit(event)}>
          <SheetFormHeader>
            <SheetTitle>Create database</SheetTitle>
            <SheetDescription>
              Create a new database on this Postgres server.
            </SheetDescription>
          </SheetFormHeader>

          <SheetFormBody>
            <FormGrid>
              <FormGridItem span="wide">
                <Field>
                  <FieldLabel htmlFor="database-name">Name</FieldLabel>
                  <Input
                    id="database-name"
                    className="field-mono"
                    value={values.name}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                    autoFocus
                  />
                  <FieldHint>{identifierHint}</FieldHint>
                </Field>
              </FormGridItem>

              <FormGridItem>
                <Field>
                  <FieldLabel htmlFor="database-owner">Owner</FieldLabel>
                  <NativeSelect
                    id="database-owner"
                    value={values.owner}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        owner: event.target.value,
                      }))
                    }
                  >
                    <option value="">Current user</option>
                    {roleNames.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </FormGridItem>

              <FormGridItem>
                <Field>
                  <FieldLabel htmlFor="database-encoding">Encoding</FieldLabel>
                  <NativeSelect
                    id="database-encoding"
                    value={values.encoding}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        encoding: event.target.value,
                      }))
                    }
                  >
                    <option value="UTF8">UTF8</option>
                    <option value="LATIN1">LATIN1</option>
                    <option value="SQL_ASCII">SQL_ASCII</option>
                  </NativeSelect>
                </Field>
              </FormGridItem>

              <FormGridItem span="wide">
                <Field>
                  <FieldLabel htmlFor="database-template">Template</FieldLabel>
                  <NativeSelect
                    id="database-template"
                    value={values.template}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        template: event.target.value,
                      }))
                    }
                  >
                    <option value="">Default (template1)</option>
                    <option value="template0">template0</option>
                    <option value="template1">template1</option>
                    {databaseNames.map((database) => (
                      <option key={database} value={database}>
                        {database}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </FormGridItem>
            </FormGrid>

            {error ? <FormAlert className="mt-4">{error}</FormAlert> : null}
          </SheetFormBody>

          <SheetFormFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create database'
              )}
            </Button>
          </SheetFormFooter>
        </SheetForm>
      </SheetContent>
    </Sheet>
  )
}

type DatabaseManagerProps = {
  connectionId: string
  readOnly: boolean
  initialDatabases: DatabaseDetails[]
}

type PendingDatabaseAction =
  | { type: 'drop'; database: DatabaseDetails }
  | { type: 'truncate'; database: DatabaseDetails }
  | { type: 'empty'; database: DatabaseDetails }

export function DatabaseManager({
  connectionId,
  readOnly,
  initialDatabases,
}: DatabaseManagerProps) {
  const [databases, setDatabases] = useState(initialDatabases)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingAction, setPendingAction] =
    useState<PendingDatabaseAction | null>(null)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    const rows = await fetchDatabaseDetails({ data: { connectionId } })
    setDatabases(rows)
  }

  const handleConfirmAction = async () => {
    if (!pendingAction) {
      return
    }

    setActing(true)
    setError(null)

    const { database, type } = pendingAction

    try {
      if (type === 'drop') {
        await removeServerDatabase({
          data: {
            connectionId,
            values: { name: database.name },
          },
        })
        toast.success(`Database "${database.name}" dropped`)
      } else if (type === 'truncate') {
        await truncateServerDatabase({
          data: {
            connectionId,
            values: { name: database.name },
          },
        })
        toast.success(`Database "${database.name}" truncated`)
      } else {
        await emptyServerDatabase({
          data: {
            connectionId,
            values: { name: database.name },
          },
        })
        toast.success(`Database "${database.name}" emptied`)
      }

      setPendingAction(null)
      await reload()
      emitSidebarRefresh({ connectionId })
    } catch (actionError) {
      const fallback =
        type === 'drop'
          ? 'Failed to drop database'
          : type === 'truncate'
            ? 'Failed to truncate database'
            : 'Failed to empty database'
      setError(formatAppError(actionError, fallback))
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Databases</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage databases on this server.
          </p>
        </div>

        {!readOnly ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New database
          </Button>
        ) : null}
      </div>

      {error ? <FormAlert className="mb-4">{error}</FormAlert> : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Owner</th>
              <th className="px-3 py-2 text-left font-medium">Encoding</th>
              <th className="px-3 py-2 text-left font-medium">Collation</th>
              <th className="px-3 py-2 text-right font-medium">Size</th>
              {!readOnly ? (
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {databases.map((database) => (
              <tr
                key={database.name}
                className="border-b border-border last:border-0"
              >
                <td className="px-3 py-2 font-mono">{database.name}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">
                  {database.owner}
                </td>
                <td className="px-3 py-2">{database.encoding}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {database.collation}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatSize(database.sizeBytes)}
                </td>
                {!readOnly ? (
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPendingAction({
                            type: 'truncate',
                            database,
                          })
                        }
                      >
                        Truncate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setPendingAction({ type: 'empty', database })
                        }
                      >
                        Empty
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          setPendingAction({ type: 'drop', database })
                        }
                      >
                        Drop
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateDatabaseSheet
        open={createOpen}
        connectionId={connectionId}
        onOpenChange={setCreateOpen}
        onCreated={reload}
      />

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'drop'
                ? 'Drop database?'
                : pendingAction?.type === 'truncate'
                  ? 'Truncate database?'
                  : 'Empty database?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'drop' ? (
                <>
                  This will permanently delete{' '}
                  <span className="font-mono">{pendingAction.database.name}</span>{' '}
                  and all of its data. Active connections will be terminated first.
                </>
              ) : pendingAction?.type === 'truncate' ? (
                <>
                  This will remove all rows from every table in{' '}
                  <span className="font-mono">{pendingAction.database.name}</span>.
                  Table structures, views, and other objects are kept. Active
                  connections will be terminated first.
                </>
              ) : pendingAction?.type === 'empty' ? (
                <>
                  This will drop all tables, views, sequences, and related objects
                  in <span className="font-mono">{pendingAction.database.name}</span>.
                  The database itself is kept. Active connections will be terminated
                  first.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={acting}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmAction()
              }}
            >
              {acting
                ? pendingAction?.type === 'drop'
                  ? 'Dropping...'
                  : pendingAction?.type === 'truncate'
                    ? 'Truncating...'
                    : 'Emptying...'
                : pendingAction?.type === 'drop'
                  ? 'Drop database'
                  : pendingAction?.type === 'truncate'
                    ? 'Truncate database'
                    : 'Empty database'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** exponent

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
