import { API_BASE, DEFAULT_MAX_SERVER_BYTES } from './compressServer'

export interface ServerHealth {
  reachable: boolean
  ghostscript: boolean
  ghostscriptVersion: string | null
  qpdf: boolean
  qpdfVersion: string | null
  maxUploadBytes: number
}

const OFFLINE: ServerHealth = {
  reachable: false,
  ghostscript: false,
  ghostscriptVersion: null,
  qpdf: false,
  qpdfVersion: null,
  maxUploadBytes: DEFAULT_MAX_SERVER_BYTES,
}

export async function checkServerHealth(): Promise<ServerHealth> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return OFFLINE

    const data = (await response.json()) as {
      ghostscript?: boolean
      version?: string | null
      qpdf?: boolean
      qpdfVersion?: string | null
      maxUploadBytes?: number
    }

    return {
      reachable: true,
      ghostscript: Boolean(data.ghostscript),
      ghostscriptVersion: data.version ?? null,
      qpdf: Boolean(data.qpdf),
      qpdfVersion: data.qpdfVersion ?? null,
      maxUploadBytes:
        typeof data.maxUploadBytes === 'number' && data.maxUploadBytes > 0
          ? data.maxUploadBytes
          : DEFAULT_MAX_SERVER_BYTES,
    }
  } catch {
    return OFFLINE
  }
}
