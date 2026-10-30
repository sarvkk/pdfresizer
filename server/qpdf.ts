import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const QPDF_BIN = process.env.QPDF_PATH?.trim() || 'qpdf'

const VERSION_CACHE_MS = 60_000
const RUN_TIMEOUT_MS = 300_000

export type PrintPermission = 'none' | 'low' | 'full'
export type ModifyPermission = 'none' | 'assembly' | 'form' | 'annotate' | 'all'

export interface PermissionOptions {
  ownerPassword: string
  print: PrintPermission
  copy: boolean
  modify: ModifyPermission
}

const PRINT_VALUES: readonly PrintPermission[] = ['none', 'low', 'full']
const MODIFY_VALUES: readonly ModifyPermission[] = [
  'none',
  'assembly',
  'form',
  'annotate',
  'all',
]

export function isPrintPermission(value: string): value is PrintPermission {
  return (PRINT_VALUES as readonly string[]).includes(value)
}

export function isModifyPermission(value: string): value is ModifyPermission {
  return (MODIFY_VALUES as readonly string[]).includes(value)
}

let versionCache: { version: string | null; checkedAt: number } | null = null

export async function getQpdfVersion(): Promise<string | null> {
  if (versionCache && Date.now() - versionCache.checkedAt < VERSION_CACHE_MS) {
    return versionCache.version
  }

  try {
    const { stdout } = await execFileAsync(QPDF_BIN, ['--version'], { timeout: 5000 })
    const firstLine = stdout.split('\n')[0]?.trim() ?? ''
    const match = /qpdf version ([0-9.]+)/i.exec(firstLine)
    const version = match?.[1] ?? (firstLine || null)
    versionCache = { version, checkedAt: Date.now() }
    return version
  } catch {
    versionCache = { version: null, checkedAt: Date.now() }
    return null
  }
}

export function buildQpdfArgs(
  inputPath: string,
  outputPath: string,
  options: PermissionOptions,
): string[] {
  return [
    '--encrypt',
    '',
    options.ownerPassword,
    '256',
    `--print=${options.print}`,
    `--extract=${options.copy ? 'y' : 'n'}`,
    `--modify=${options.modify}`,
    // Keep text extraction available to screen readers. Acrobat exposes this
    // as a separate accessibility permission and recommends leaving it on.
    '--accessibility=y',
    '--',
    inputPath,
    outputPath,
  ]
}

export function runQpdf(
  inputPath: string,
  outputPath: string,
  options: PermissionOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(QPDF_BIN, buildQpdfArgs(inputPath, outputPath, options), {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve()
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(new Error('Permissions timed out after five minutes.'))
    }, RUN_TIMEOUT_MS)

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 8000) stderr += chunk.toString()
    })

    child.on('error', (err) => {
      finish(new Error(`qpdf failed to start: ${err.message}`))
    })

    child.on('close', (code) => {
      if (code === 0) finish()
      else finish(new Error(stderr.trim() || `qpdf exited with code ${code}`))
    })
  })
}
