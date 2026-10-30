import type { CompressionLevel, CompressResult } from './compress'

export const DEFAULT_MAX_SERVER_BYTES = 200 * 1024 * 1024

export function formatUploadLimit(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`
}

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined
export const API_BASE = (RAW_API_BASE ?? '').replace(/\/+$/, '')

export interface CompressApiStatus {
  reachable: boolean
  ghostscript: boolean
  version: string | null
  maxUploadBytes: number
}

export async function compressPdfOnServer(
  file: File,
  level: CompressionLevel = 'balanced',
  maxUploadBytes = DEFAULT_MAX_SERVER_BYTES,
): Promise<CompressResult> {
  if (file.size > maxUploadBytes) {
    throw new Error(
      `Server mode accepts files up to ${formatUploadLimit(maxUploadBytes)}. Try in-browser mode instead.`,
    )
  }

  const form = new FormData()
  form.append('file', file, file.name)
  form.append('level', level)

  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/compress`, {
      method: 'POST',
      body: form,
    })
  } catch {
    throw new Error(
      'Could not reach the compress API. Start it with pnpm dev:api, or use in-browser mode.',
    )
  }

  if (!response.ok) {
    let message = 'Server compression failed.'
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // Ignore JSON parse errors and keep the generic message.
    }
    throw new Error(message)
  }

  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const originalHeader = response.headers.get('X-Original-Size')
  const compressedHeader = response.headers.get('X-Compressed-Size')

  return {
    bytes,
    originalSize: originalHeader ? Number(originalHeader) : file.size,
    compressedSize: compressedHeader ? Number(compressedHeader) : bytes.length,
  }
}

export async function checkCompressApi(): Promise<CompressApiStatus> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return {
        reachable: false,
        ghostscript: false,
        version: null,
        maxUploadBytes: DEFAULT_MAX_SERVER_BYTES,
      }
    }

    const data = (await response.json()) as {
      ghostscript?: boolean
      version?: string | null
      maxUploadBytes?: number
    }

    return {
      reachable: true,
      ghostscript: Boolean(data.ghostscript),
      version: data.version ?? null,
      maxUploadBytes:
        typeof data.maxUploadBytes === 'number' && data.maxUploadBytes > 0
          ? data.maxUploadBytes
          : DEFAULT_MAX_SERVER_BYTES,
    }
  } catch {
    return {
      reachable: false,
      ghostscript: false,
      version: null,
      maxUploadBytes: DEFAULT_MAX_SERVER_BYTES,
    }
  }
}
