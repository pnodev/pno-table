import { LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { RoleDatabaseAccessSection } from '#/components/admin/RoleDatabaseAccessSection'
import { Button } from '#/components/ui/button'
import {
  Field,
  FieldHint,
  FieldLabel,
  FormAlert,
  FormGrid,
  FormGridItem,
} from '#/components/ui/form-layout'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
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
import { Switch } from '#/components/ui/switch'
import type { RoleDatabaseAccess, RoleInfo } from '#/lib/pg/catalog-types'
import { createRoleSchema, updateRoleSchema } from '#/lib/pg/admin-schemas'
import { formatAppError } from '#/lib/format-error'
import {
  createServerRole,
  saveServerRoleDatabaseAccess,
  updateServerRole,
} from '#/server/admin'

type RoleFormValues = {
  name: string
  password: string
  login: boolean
  superuser: boolean
  createdb: boolean
  createrole: boolean
  replication: boolean
  bypassRls: boolean
  connectionLimit: string
}

type RoleFormSheetProps = {
  open: boolean
  mode: 'create' | 'edit'
  connectionId: string
  readOnly: boolean
  role?: RoleInfo
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}

const defaultValues: RoleFormValues = {
  name: '',
  password: '',
  login: true,
  superuser: false,
  createdb: false,
  createrole: false,
  replication: false,
  bypassRls: false,
  connectionLimit: '-1',
}

function roleToValues(role: RoleInfo): RoleFormValues {
  return {
    name: role.name,
    password: '',
    login: role.canLogin,
    superuser: role.isSuperuser,
    createdb: role.canCreateDb,
    createrole: role.canCreateRole,
    replication: role.isReplication,
    bypassRls: role.bypassRls,
    connectionLimit: String(role.connectionLimit),
  }
}

function databaseAccessSnapshot(entries: RoleDatabaseAccess[]) {
  return entries.map((entry) => ({
    database: entry.database,
    canConnect: entry.canConnect,
    canCreate: entry.canConnect && entry.canCreate,
  }))
}

function PrivilegeSwitch({
  id,
  label,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  id: string
  label: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

export function RoleFormSheet({
  open,
  mode,
  connectionId,
  readOnly,
  role,
  onOpenChange,
  onSaved,
}: RoleFormSheetProps) {
  const [values, setValues] = useState<RoleFormValues>(defaultValues)
  const [databaseAccess, setDatabaseAccess] = useState<RoleDatabaseAccess[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const databaseAccessBaselineSetRef = useRef(false)

  const handleDatabaseAccessLoaded = useCallback(() => {
    databaseAccessBaselineSetRef.current = true
  }, [])

  useEffect(() => {
    if (!open) {
      databaseAccessBaselineSetRef.current = false
      return
    }

    setError(null)
    setValues(mode === 'edit' && role ? roleToValues(role) : defaultValues)
    setDatabaseAccess([])
    databaseAccessBaselineSetRef.current = false
  }, [open, mode, role])

  const updateBoolean = (key: keyof RoleFormValues, checked: boolean) => {
    setValues((current) => ({ ...current, [key]: checked }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (mode === 'create' && values.login && !values.password.trim()) {
      setError('Password is required for login roles')
      return
    }

    const connectionLimit = Number(values.connectionLimit)
    if (!Number.isInteger(connectionLimit) || connectionLimit < -1) {
      setError('Connection limit must be -1 (unlimited) or a non-negative integer')
      return
    }

    const payload = {
      login: values.login,
      superuser: values.superuser,
      createdb: values.createdb,
      createrole: values.createrole,
      replication: values.replication,
      bypassRls: values.bypassRls,
      connectionLimit,
      ...(values.password.trim() ? { password: values.password.trim() } : {}),
    }

    if (mode === 'create') {
      const parsed = createRoleSchema.safeParse({
        name: values.name.trim(),
        ...payload,
      })

      if (!parsed.success) {
        setError(formatAppError(parsed.error))
        return
      }

      setSaving(true)

      try {
        await createServerRole({
          data: {
            connectionId,
            values: parsed.data,
          },
        })
        onOpenChange(false)
        await onSaved()
      } catch (submitError) {
        setError(formatAppError(submitError, 'Failed to save role'))
      } finally {
        setSaving(false)
      }

      return
    }

    if (!role) {
      return
    }

    const parsed = updateRoleSchema.safeParse({
      name: role.name,
      ...payload,
    })

    if (!parsed.success) {
      setError(formatAppError(parsed.error))
      return
    }

    setSaving(true)

    try {
      await updateServerRole({
        data: {
          connectionId,
          values: parsed.data,
        },
      })

      if (!readOnly && databaseAccessBaselineSetRef.current) {
        await saveServerRoleDatabaseAccess({
          data: {
            connectionId,
            values: {
              role: role.name,
              databases: databaseAccessSnapshot(databaseAccess),
            },
          },
        })
      }

      onOpenChange(false)
      await onSaved()
    } catch (submitError) {
      setError(formatAppError(submitError, 'Failed to save role'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size={mode === 'edit' ? 'lg' : 'md'} padding="none">
        <SheetForm onSubmit={(event) => void handleSubmit(event)}>
          <SheetFormHeader>
            <SheetTitle>
              {mode === 'create' ? 'Create role' : `Edit ${role?.name}`}
            </SheetTitle>
            <SheetDescription>
              {mode === 'create'
                ? 'Create a new Postgres role on this server.'
                : 'Update privileges, database access, or set a new password.'}
            </SheetDescription>
          </SheetFormHeader>

          <SheetFormBody>
            <FormGrid>
              {mode === 'create' ? (
                <FormGridItem span="wide">
                  <Field>
                    <FieldLabel htmlFor="role-name">Name</FieldLabel>
                    <Input
                      id="role-name"
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
                    <FieldHint>
                      Letters, numbers, and underscores. No spaces.
                    </FieldHint>
                  </Field>
                </FormGridItem>
              ) : null}

              <FormGridItem span="wide">
                <Field>
                  <FieldLabel htmlFor="role-password">
                    {mode === 'create' ? 'Password' : 'New password'}
                  </FieldLabel>
                  <Input
                    id="role-password"
                    type="password"
                    value={values.password}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required={mode === 'create' && values.login}
                    placeholder={
                      mode === 'edit' ? 'Leave blank to keep current password' : ''
                    }
                  />
                </Field>
              </FormGridItem>

              <FormGridItem span="wide">
                <Field>
                  <FieldLabel htmlFor="role-connection-limit">
                    Connection limit
                  </FieldLabel>
                  <Input
                    id="role-connection-limit"
                    className="field-mono"
                    value={values.connectionLimit}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        connectionLimit: event.target.value,
                      }))
                    }
                  />
                  <FieldHint>Use -1 for unlimited connections.</FieldHint>
                </Field>
              </FormGridItem>

              <FormGridItem span="wide">
                <div className="space-y-2">
                  <PrivilegeSwitch
                    id="role-login"
                    label="Can login"
                    checked={values.login}
                    disabled={readOnly}
                    onCheckedChange={(checked) => updateBoolean('login', checked)}
                  />
                  <PrivilegeSwitch
                    id="role-superuser"
                    label="Superuser"
                    checked={values.superuser}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateBoolean('superuser', checked)
                    }
                  />
                  <PrivilegeSwitch
                    id="role-createdb"
                    label="Create databases"
                    checked={values.createdb}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateBoolean('createdb', checked)
                    }
                  />
                  <PrivilegeSwitch
                    id="role-createrole"
                    label="Create roles"
                    checked={values.createrole}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateBoolean('createrole', checked)
                    }
                  />
                  <PrivilegeSwitch
                    id="role-replication"
                    label="Replication"
                    checked={values.replication}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateBoolean('replication', checked)
                    }
                  />
                  <PrivilegeSwitch
                    id="role-bypass-rls"
                    label="Bypass row-level security"
                    checked={values.bypassRls}
                    disabled={readOnly}
                    onCheckedChange={(checked) =>
                      updateBoolean('bypassRls', checked)
                    }
                  />
                </div>
              </FormGridItem>

              {mode === 'edit' && role ? (
                <FormGridItem span="wide">
                  <RoleDatabaseAccessSection
                    connectionId={connectionId}
                    roleName={role.name}
                    readOnly={readOnly}
                    isSuperuser={values.superuser}
                    value={databaseAccess}
                    onChange={setDatabaseAccess}
                    onLoaded={handleDatabaseAccessLoaded}
                  />
                </FormGridItem>
              ) : null}

              {mode === 'create' ? (
                <FormGridItem span="wide">
                  <FieldHint>
                    Database access can be configured after the role is created.
                  </FieldHint>
                </FormGridItem>
              ) : null}
            </FormGrid>

            {error ? <FormAlert>{error}</FormAlert> : null}
          </SheetFormBody>

          <SheetFormFooter>
            <Button type="submit" disabled={saving || readOnly}>
              {saving ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Saving...
                </>
              ) : mode === 'create' ? (
                'Create role'
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
