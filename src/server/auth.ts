import { createServerFn } from '@tanstack/react-start'
import {
  clearSession,
  getSession,
  updateSession,
} from '@tanstack/react-start/server'
import { z } from 'zod'

import {
  getSessionConfig,
  isAuthEnabled,
  verifyAuthPassword,
  type AuthSessionData,
} from '#/lib/auth/config'
import { defaultAuthStatus, type AuthStatus } from '#/lib/auth/types'

export type { AuthStatus } from '#/lib/auth/types'
export { defaultAuthStatus } from '#/lib/auth/types'

const loginSchema = z.object({
  password: z.string().min(1),
})

async function readAuthStatus(): Promise<AuthStatus> {
  if (!isAuthEnabled()) {
    return defaultAuthStatus
  }

  const session = await getSession<AuthSessionData>(getSessionConfig())

  if (session.data.authenticated) {
    return {
      enabled: true,
      authenticated: true,
    }
  }

  return {
    enabled: true,
    authenticated: false,
  }
}

export const getAuthStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AuthStatus> => readAuthStatus(),
)

export const login = createServerFn({ method: 'POST' })
  .validator((data) => loginSchema.parse(data))
  .handler(async ({ data }): Promise<AuthStatus> => {
    if (!isAuthEnabled()) {
      return readAuthStatus()
    }

    if (!verifyAuthPassword(data.password)) {
      throw new Error('Invalid password')
    }

    await updateSession<AuthSessionData>(getSessionConfig(), {
      authenticated: true,
    })

    return readAuthStatus()
  })

export const logout = createServerFn({ method: 'POST' }).handler(
  async (): Promise<AuthStatus> => {
    if (isAuthEnabled()) {
      await clearSession(getSessionConfig())
    }

    return readAuthStatus()
  },
)
