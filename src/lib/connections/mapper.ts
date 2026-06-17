import type { ConnectionProfile, ConnectionRecord } from '#/lib/connections/types'

export function toConnectionProfile(
  record: ConnectionRecord,
): ConnectionProfile {
  const { passwordEncrypted: _passwordEncrypted, ...profile } = record
  return profile
}
