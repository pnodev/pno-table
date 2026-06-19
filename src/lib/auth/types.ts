export type AuthStatus = {
  enabled: boolean
  authenticated: boolean
}

export const defaultAuthStatus: AuthStatus = {
  enabled: false,
  authenticated: true,
}
