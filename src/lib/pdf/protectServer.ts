import { API_BASE, DEFAULT_MAX_SERVER_BYTES, formatUploadLimit } from './compressServer'

export type PrintPermission = 'none' | 'low' | 'full'
export type ModifyPermission = 'none' | 'assembly' | 'form' | 'annotate' | 'all'

export interface PermissionOptions {
  ownerPassword: string
  print: PrintPermission
  copy: boolean
  modify: ModifyPermission
}

export interface CertifyOptions {
  p12: File
  passphrase: string
  name: string
  reason: string
  location: string
  permission: 1 | 2
}

export interface ProtectedPdf {
  bytes: Uint8Array
  originalSize: number
  outputSize: number
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    // Keep the fallback when the response is not JSON.
  }
  return fallback
}

function sizeFromHeader(response: Response, name: string, fallback: number): number {
  const value = response.headers.get(name)
  const parsed = value ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function protectPdfOnServer(
  file: File,
  options: PermissionOptions,
  maxUploadBytes = DEFAULT_MAX_SERVER_BYTES,
): Promise<ProtectedPdf> {
  if (file.size > maxUploadBytes) {
    throw new Error(`The local API accepts files up to ${formatUploadLimit(maxUploadBytes)}.`)
  }
  if (!options.ownerPassword.trim()) {
    throw new Error('Enter an owner password.')
  }

  const form = new FormData()
  form.append('file', file, file.name)
  form.append('ownerPassword', options.ownerPassword)
  form.append('print', options.print)
  form.append('copy', String(options.copy))
  form.append('modify', options.modify)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/protect`, { method: 'POST', body: form })
  } catch {
    throw new Error('Could not reach the local API. Start it with pnpm dev:api and try again.')
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Could not apply these permissions.'))
  }

  const bytes = new Uint8Array(await response.arrayBuffer())

  return {
    bytes,
    originalSize: sizeFromHeader(response, 'X-Original-Size', file.size),
    outputSize: sizeFromHeader(response, 'X-Protected-Size', bytes.length),
  }
}

export async function certifyPdfOnServer(
  file: File,
  options: CertifyOptions,
  maxUploadBytes = DEFAULT_MAX_SERVER_BYTES,
): Promise<ProtectedPdf> {
  if (file.size > maxUploadBytes) {
    throw new Error(`The local API accepts files up to ${formatUploadLimit(maxUploadBytes)}.`)
  }
  if (options.p12.size > 2 * 1024 * 1024) {
    throw new Error('The certificate file must be 2 MB or smaller.')
  }

  const form = new FormData()
  form.append('file', file, file.name)
  form.append('p12', options.p12, options.p12.name)
  form.append('passphrase', options.passphrase)
  form.append('name', options.name)
  form.append('reason', options.reason)
  form.append('location', options.location)
  form.append('permission', String(options.permission))

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/certify`, { method: 'POST', body: form })
  } catch {
    throw new Error('Could not reach the local API. Start it with pnpm dev:api and try again.')
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Could not certify this PDF.'))
  }

  const bytes = new Uint8Array(await response.arrayBuffer())

  return {
    bytes,
    originalSize: sizeFromHeader(response, 'X-Original-Size', file.size),
    outputSize: sizeFromHeader(response, 'X-Certified-Size', bytes.length),
  }
}
