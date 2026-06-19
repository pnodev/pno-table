import { createMiddleware } from '@tanstack/react-start'
import { getSession } from '@tanstack/react-start/server'

import {
  getSessionConfig,
  isAuthEnabled,
  isPublicAuthServerFunction,
  type AuthSessionData,
} from '#/lib/auth/config'

async function hasAuthenticatedSession(): Promise<boolean> {
  if (!isAuthEnabled()) {
    return true
  }

  const session = await getSession<AuthSessionData>(getSessionConfig())
  return session.data.authenticated === true
}

export const requireAuthFunctionMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next, serverFnMeta }) => {
  if (!isAuthEnabled()) {
    return next()
  }

  if (isPublicAuthServerFunction(serverFnMeta.name)) {
    return next()
  }

  if (!(await hasAuthenticatedSession())) {
    throw new Error('Unauthorized')
  }

  return next()
})
