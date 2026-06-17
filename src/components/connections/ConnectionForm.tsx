import { useRouter } from '@tanstack/react-router'
import { LoaderCircle, PlugZap } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { FormAlert } from '#/components/ui/form-layout'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import type { ConnectionInput } from '#/lib/connections/schemas'
import {
  parseConnectionString,
  suggestConnectionName,
} from '#/lib/connections/parse-connection-string'
import type { ConnectionProfile } from '#/lib/connections/types'
import {
  createConnection,
  testConnectionDraft,
  testSavedConnection,
  updateConnection,
} from '#/server/connections'

type ConnectionFormProps = {
  mode: 'create' | 'edit'
  initialValues?: ConnectionProfile
}

const defaultValues: ConnectionInput = {
  name: '',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '',
  defaultDatabase: 'postgres',
  sslMode: 'prefer',
  readOnly: false,
}

export function ConnectionForm({ mode, initialValues }: ConnectionFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<ConnectionInput>({
    ...defaultValues,
    ...(initialValues
      ? {
          name: initialValues.name,
          host: initialValues.host,
          port: initialValues.port,
          username: initialValues.username,
          password: '',
          defaultDatabase: initialValues.defaultDatabase,
          sslMode: initialValues.sslMode,
          readOnly: initialValues.readOnly,
        }
      : {}),
  })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connectionString, setConnectionString] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [parseMessage, setParseMessage] = useState<string | null>(null)

  const updateField = <K extends keyof ConnectionInput>(
    key: K,
    value: ConnectionInput[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const applyConnectionString = () => {
    setError(null)
    setParseMessage(null)
    setTestMessage(null)

    const result = parseConnectionString(connectionString)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setValues((current) => ({
      ...current,
      ...result.value,
      name: current.name.trim()
        ? current.name
        : suggestConnectionName(result.value),
    }))
    setParseMessage('Connection string applied to the form below.')
  }

  const handleConnectionStringPaste = (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const pasted = event.clipboardData.getData('text').trim()

    if (!pasted) {
      return
    }

    const result = parseConnectionString(pasted)

    if (!result.ok) {
      return
    }

    event.preventDefault()
    setConnectionString(pasted)
    setError(null)
    setTestMessage(null)
    setParseMessage(null)
    setValues((current) => ({
      ...current,
      ...result.value,
      name: current.name.trim()
        ? current.name
        : suggestConnectionName(result.value),
    }))
    setParseMessage('Connection string applied to the form below.')
  }

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    setTestMessage(null)

    try {
      const result =
        mode === 'edit' && !values.password && initialValues
          ? await testSavedConnection({ data: { id: initialValues.id } })
          : await testConnectionDraft({ data: values })

      if (result.ok) {
        setTestMessage(
          `Connected to ${result.database}. ${result.version} (${result.latencyMs}ms)`,
        )
      } else {
        setError(result.error || 'Connection test failed')
      }
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message || 'Failed to test connection'
          : 'Failed to test connection',
      )
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setTestMessage(null)

    try {
      if (mode === 'create') {
        const created = await createConnection({ data: values })
        await router.navigate({
          to: '/connect/$connectionId',
          params: { connectionId: created.id },
        })
        return
      }

      if (!initialValues) {
        throw new Error('Missing connection to update')
      }

      const { password, ...rest } = values

      await updateConnection({
        data: {
          id: initialValues.id,
          values: {
            ...rest,
            ...(password ? { password } : {}),
          },
        },
      })
      await router.navigate({ to: '/' })
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Failed to save connection',
      )
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="space-y-1">
          <Label htmlFor="connectionString">Connection string</Label>
          <p className="text-muted-foreground text-xs">
            Paste a <code>postgresql://</code> URL or libpq{' '}
            <code>host=... dbname=...</code> string to fill the form.
          </p>
        </div>
        <Textarea
          id="connectionString"
          value={connectionString}
          onChange={(event) => setConnectionString(event.target.value)}
          onPaste={handleConnectionStringPaste}
          placeholder="postgresql://user:password@localhost:5432/mydb?sslmode=require"
          rows={3}
          className="font-mono text-sm"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={applyConnectionString}
            disabled={!connectionString.trim() || saving || testing}
          >
            Apply connection string
          </Button>
        </div>
        {parseMessage ? (
          <p className="text-sm text-muted-foreground">{parseMessage}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Connection name</Label>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Local dev"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="host">Host</Label>
          <Input
            id="host"
            value={values.host}
            onChange={(event) => updateField('host', event.target.value)}
            placeholder="localhost"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="port">Port</Label>
          <Input
            id="port"
            type="number"
            min={1}
            max={65535}
            value={values.port}
            onChange={(event) =>
              updateField('port', Number(event.target.value))
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={values.username}
            onChange={(event) => updateField('username', event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            Password{mode === 'edit' ? ' (leave blank to keep current)' : ''}
          </Label>
          <Input
            id="password"
            type="password"
            value={values.password}
            onChange={(event) => updateField('password', event.target.value)}
            required={mode === 'create'}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="defaultDatabase">Default database</Label>
          <Input
            id="defaultDatabase"
            value={values.defaultDatabase}
            onChange={(event) =>
              updateField('defaultDatabase', event.target.value)
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sslMode">SSL mode</Label>
          <select
            id="sslMode"
            value={values.sslMode}
            onChange={(event) =>
              updateField(
                'sslMode',
                event.target.value as ConnectionInput['sslMode'],
              )
            }
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
          >
            <option value="disable">Disable</option>
            <option value="prefer">Prefer</option>
            <option value="require">Require</option>
          </select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="readOnly">Read-only mode</Label>
            <p className="text-muted-foreground text-xs">
              Block write operations in upcoming browse and SQL features.
            </p>
          </div>
          <Switch
            id="readOnly"
            checked={values.readOnly}
            onCheckedChange={(checked) => updateField('readOnly', checked)}
          />
        </div>
      </div>

      {testMessage ? (
        <FormAlert variant="success">{testMessage}</FormAlert>
      ) : null}

      {error ? <FormAlert>{error}</FormAlert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || testing}>
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : null}
          {mode === 'create' ? 'Save connection' : 'Update connection'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={saving || testing}
        >
          {testing ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <PlugZap className="size-4" />
          )}
          Test connection
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.navigate({ to: '/' })}
          disabled={saving || testing}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
