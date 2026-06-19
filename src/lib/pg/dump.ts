import { spawn } from 'node:child_process'

import type { PostgresConnectionConfig } from '#/lib/connections/types'

export type DumpExportOptions = {
  schemaOnly?: boolean
  dataOnly?: boolean
  noOwner?: boolean
  noPrivileges?: boolean
}

export type DumpImportOptions = {
  singleTransaction?: boolean
  onErrorStop?: boolean
}

type CommandResult = {
  stdout: string
  stderr: string
}

function pgEnv(
  config: PostgresConnectionConfig,
  database: string,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST: config.host,
    PGPORT: String(config.port),
    PGUSER: config.username,
    PGPASSWORD: config.password,
    PGDATABASE: database,
    PGSSLMODE: config.sslMode,
  }
}

export function buildPgDumpArgs(options: DumpExportOptions): string[] {
  const args = ['--no-password', '--format=plain']

  if (options.schemaOnly) {
    args.push('--schema-only')
  }

  if (options.dataOnly) {
    args.push('--data-only')
  }

  if (options.noOwner ?? true) {
    args.push('--no-owner')
  }

  if (options.noPrivileges ?? true) {
    args.push('--no-privileges')
  }

  return args
}

export function buildPsqlArgs(options: DumpImportOptions): string[] {
  const args = ['--no-password', '--echo-errors']

  if (options.singleTransaction ?? true) {
    args.push('--single-transaction')
  }

  if (options.onErrorStop ?? true) {
    args.push('--set', 'ON_ERROR_STOP=on')
  }

  return args
}

async function runCommand(
  command: string,
  args: string[],
  options: {
    env: NodeJS.ProcessEnv
    stdin?: string
  },
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      if ('code' in error && error.code === 'ENOENT') {
        reject(
          new Error(
            `${command} is not installed. Install the PostgreSQL client tools to use dump export/import.`,
          ),
        )
        return
      }

      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }

      const message = stderr.trim() || `${command} failed with exit code ${code}`
      reject(new Error(message))
    })

    if (options.stdin !== undefined) {
      child.stdin.write(options.stdin)
    }

    child.stdin.end()
  })
}

export async function exportDatabaseDump(
  config: PostgresConnectionConfig,
  database: string,
  options: DumpExportOptions = {},
): Promise<string> {
  const args = buildPgDumpArgs(options)
  const { stdout } = await runCommand('pg_dump', args, {
    env: pgEnv(config, database),
  })

  return stdout
}

export async function importDatabaseDump(
  config: PostgresConnectionConfig,
  database: string,
  sql: string,
  options: DumpImportOptions = {},
): Promise<void> {
  const args = buildPsqlArgs(options)

  await runCommand('psql', args, {
    env: pgEnv(config, database),
    stdin: sql,
  })
}

export function dumpFilename(database: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return `${database}-${date}.sql`
}
