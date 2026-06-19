import { timingSafeEqual } from 'node:crypto'

import { env } from '#/env'

export const AUTH_SESSION_NAME = 'pno-table-session'

export type AuthSessionData = {
  authenticated: true
}

export function isAuthEnabled(): boolean {
  return Boolean(env.PNO_AUTH_PASSWORD)
}

export function getSessionPassword(): string {
  return env.PNO_MASTER_KEY
}

export function getSessionConfig() {
  return {
    name: AUTH_SESSION_NAME,
    password: getSessionPassword(),
    maxAge: 60 * 60 * 24 * 7,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    },
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function verifyAuthPassword(password: string): boolean {
  if (!isAuthEnabled() || !env.PNO_AUTH_PASSWORD) {
    return false
  }

  return safeEqual(password, env.PNO_AUTH_PASSWORD)
}

export function isPublicAuthServerFunction(name: string): boolean {
  return name === 'login' || name === 'logout' || name === 'getAuthStatus'
}
