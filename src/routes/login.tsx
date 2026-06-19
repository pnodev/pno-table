import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { Button } from '#/components/ui/button'
import {
  Field,
  FieldHint,
  FieldLabel,
  FormAlert,
} from '#/components/ui/form-layout'
import { Input } from '#/components/ui/input'
import { login } from '#/server/auth'

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login({ data: { password } })
      await navigate({ to: redirect ?? '/' })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not sign in. Try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap flex min-h-[calc(100vh-0px)] items-center justify-center px-4 py-10">
      <section className="content-panel w-full rounded-xl p-6 sm:p-8">
        <div className="mb-8 space-y-2">
          <p className="island-kicker">Access</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter the shared password configured for this deployment.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error ? <FormAlert>{error}</FormAlert> : null}

          <Field>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <FieldHint>
              Set <code>PNO_AUTH_PASSWORD</code> on the server to enable this
              gate.
            </FieldHint>
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Back</Link>
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
