import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { loadEnvFile } from 'node:process'
import { getQpdfVersion, isModifyPermission, isPrintPermission, runQpdf } from './qpdf'
import { certifyPdf } from './sign/certify'
import type { MdpPermission } from './sign/placeholder'

try {
  loadEnvFile()
} catch {
  // .env is optional.
}

const execFileAsync = promisify(execFile)

const MAX_UPLOAD_MB = Math.max(1, Math.round(Number(process.env.MAX_UPLOAD_MB) || 200))
const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024
const BODY_LIMIT = MAX_BYTES + 2 * 1024 * 1024
const CERTIFY_BODY_LIMIT = MAX_BYTES + 4 * 1024 * 1024
const MAX_P12_BYTES = 2 * 1024 * 1024
const PORT = Number(process.env.PORT) || 8787
const GS_TIMEOUT_MS = 600_000
const GS_CACHE_MS = 60_000

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? DEFAULT_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

type CompressionLevel = 'light' | 'balanced' | 'aggressive'

const GS_SETTINGS: Record<CompressionLevel, string> = {
  light: '/printer',
  balanced: '/ebook',
  aggressive: '/screen',
}

function isCompressionLevel(value: string): value is CompressionLevel {
  return value === 'light' || value === 'balanced' || value === 'aggressive'
}

let ghostscriptCache: { version: string | null; checkedAt: number } | null = null

async function getGhostscriptVersion(): Promise<string | null> {
  if (ghostscriptCache && Date.now() - ghostscriptCache.checkedAt < GS_CACHE_MS) {
    return ghostscriptCache.version
  }

  try {
    const { stdout } = await execFileAsync('gs', ['--version'], { timeout: 5000 })
    const version = stdout.trim() || null
    ghostscriptCache = { version, checkedAt: Date.now() }
    return version
  } catch {
    ghostscriptCache = { version: null, checkedAt: Date.now() }
    return null
  }
}

function runGhostscript(
  inputPath: string,
  outputPath: string,
  level: CompressionLevel,
): Promise<void> {
  const settings = GS_SETTINGS[level]

  return new Promise((resolve, reject) => {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${settings}`,
      '-dAutoRotatePages=/None',
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]

    const child = spawn('gs', args, { stdio: ['ignore', 'pipe', 'pipe'] })
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
      finish(new Error('Compression timed out after 10 minutes.'))
    }, GS_TIMEOUT_MS)

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < 8000) stderr += chunk.toString()
    })

    child.on('error', (err) => {
      finish(new Error(`Ghostscript failed to start: ${err.message}`))
    })

    child.on('close', (code) => {
      if (code === 0) finish()
      else finish(new Error(stderr.trim() || `Ghostscript exited with code ${code}`))
    })
  })
}

type PdfUploadCheck =
  | { ok: true; file: File }
  | { ok: false; status: 400 | 413; error: string }

function checkPdfUpload(value: unknown): PdfUploadCheck {
  if (!(value instanceof File)) {
    return { ok: false, status: 400, error: 'Missing PDF file.' }
  }
  if (value.size === 0) {
    return { ok: false, status: 400, error: 'Empty file.' }
  }
  if (value.size > MAX_BYTES) {
    return { ok: false, status: 413, error: `File too large. Max size is ${MAX_UPLOAD_MB} MB.` }
  }

  const name = value.name.toLowerCase()
  if (!name.endsWith('.pdf') && value.type !== 'application/pdf') {
    return { ok: false, status: 400, error: 'Only PDF files are accepted.' }
  }

  return { ok: true, file: value }
}

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: CORS_ORIGINS,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.get('/api/health', async (c) => {
  const [version, qpdfVersion] = await Promise.all([getGhostscriptVersion(), getQpdfVersion()])
  return c.json({
    ok: true,
    ghostscript: Boolean(version),
    version,
    qpdf: Boolean(qpdfVersion),
    qpdfVersion,
    maxUploadBytes: MAX_BYTES,
  })
})

app.post(
  '/api/compress',
  bodyLimit({
    maxSize: BODY_LIMIT,
    onError: (c) => c.json({ error: `File too large. Max size is ${MAX_UPLOAD_MB} MB.` }, 413),
  }),
  async (c) => {
    let form: FormData
    try {
      form = await c.req.formData()
    } catch {
      return c.json({ error: 'Expected multipart form data.' }, 400)
    }

    const file = form.get('file')
    const levelRaw = String(form.get('level') ?? 'balanced')
    const level: CompressionLevel = isCompressionLevel(levelRaw) ? levelRaw : 'balanced'

    if (!(file instanceof File)) {
      return c.json({ error: 'Missing PDF file.' }, 400)
    }

    if (file.size === 0) {
      return c.json({ error: 'Empty file.' }, 400)
    }

    if (file.size > MAX_BYTES) {
      return c.json({ error: `File too large. Max size is ${MAX_UPLOAD_MB} MB.` }, 413)
    }

    const name = file.name.toLowerCase()
    if (!name.endsWith('.pdf') && file.type !== 'application/pdf') {
      return c.json({ error: 'Only PDF files are accepted.' }, 400)
    }

    const version = await getGhostscriptVersion()
    if (!version) {
      return c.json(
        {
          error:
            'Ghostscript is not installed or not on PATH. Install it and restart the API, or use in-browser mode.',
        },
        503,
      )
    }

    const jobId = randomUUID()
    const workDir = join(tmpdir(), `sheet-compress-${jobId}`)
    const inputPath = join(workDir, 'input.pdf')
    const outputPath = join(workDir, 'output.pdf')

    try {
      await mkdir(workDir, { recursive: true })
      const inputBytes = Buffer.from(await file.arrayBuffer())

      if (inputBytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return c.json({ error: 'That file does not look like a PDF.' }, 400)
      }

      await writeFile(inputPath, inputBytes)
      await runGhostscript(inputPath, outputPath, level)

      const outputBytes = await readFile(outputPath)
      if (outputBytes.length === 0) {
        throw new Error('Ghostscript produced an empty file.')
      }

      return c.body(outputBytes, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="compressed.pdf"',
        'X-Original-Size': String(inputBytes.length),
        'X-Compressed-Size': String(outputBytes.length),
        'X-Compression-Level': level,
        'X-Ghostscript-Version': version,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compression failed.'
      console.error('[compress]', message)
      return c.json({ error: message }, 500)
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
  },
)

app.post(
  '/api/protect',
  bodyLimit({
    maxSize: BODY_LIMIT,
    onError: (c) => c.json({ error: `File too large. Max size is ${MAX_UPLOAD_MB} MB.` }, 413),
  }),
  async (c) => {
    let form: FormData
    try {
      form = await c.req.formData()
    } catch {
      return c.json({ error: 'Expected multipart form data.' }, 400)
    }

    const upload = checkPdfUpload(form.get('file'))
    if (!upload.ok) return c.json({ error: upload.error }, upload.status)

    const ownerPassword = String(form.get('ownerPassword') ?? '')
    if (!ownerPassword.trim()) {
      return c.json({ error: 'Enter an owner password.' }, 400)
    }

    const printRaw = String(form.get('print') ?? 'full')
    const modifyRaw = String(form.get('modify') ?? 'none')
    if (!isPrintPermission(printRaw)) {
      return c.json({ error: 'Invalid printing permission.' }, 400)
    }
    if (!isModifyPermission(modifyRaw)) {
      return c.json({ error: 'Invalid editing permission.' }, 400)
    }

    const copy = String(form.get('copy') ?? 'false') === 'true'

    const qpdfVersion = await getQpdfVersion()
    if (!qpdfVersion) {
      return c.json(
        {
          error:
            'qpdf is not installed or not on PATH. Install it (sudo apt install qpdf, or brew install qpdf), restart the API, and try again.',
        },
        503,
      )
    }

    const jobId = randomUUID()
    const workDir = join(tmpdir(), `sheet-protect-${jobId}`)
    const inputPath = join(workDir, 'input.pdf')
    const outputPath = join(workDir, 'output.pdf')

    try {
      await mkdir(workDir, { recursive: true })
      const inputBytes = Buffer.from(await upload.file.arrayBuffer())

      if (inputBytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return c.json({ error: 'That file does not look like a PDF.' }, 400)
      }

      await writeFile(inputPath, inputBytes)
      await runQpdf(inputPath, outputPath, {
        ownerPassword,
        print: printRaw,
        copy,
        modify: modifyRaw,
      })

      const outputBytes = await readFile(outputPath)
      if (outputBytes.length === 0) {
        throw new Error('qpdf produced an empty file.')
      }

      return c.body(outputBytes, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="protected.pdf"',
        'X-Original-Size': String(inputBytes.length),
        'X-Protected-Size': String(outputBytes.length),
        'X-Print-Permission': printRaw,
        'X-Modify-Permission': modifyRaw,
        'X-Copy-Permission': copy ? 'allowed' : 'blocked',
        'X-Qpdf-Version': qpdfVersion,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Protection failed.'
      console.error('[protect]', message)
      if (/encrypt|password/i.test(message)) {
        return c.json(
          { error: 'This PDF is already password-protected. Remove the existing password first.' },
          400,
        )
      }
      return c.json(
        { error: 'qpdf could not apply these permissions. Check that the PDF is not corrupted.' },
        500,
      )
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
  },
)

app.post(
  '/api/certify',
  bodyLimit({
    maxSize: CERTIFY_BODY_LIMIT,
    onError: (c) => c.json({ error: `File too large. Max size is ${MAX_UPLOAD_MB} MB.` }, 413),
  }),
  async (c) => {
    let form: FormData
    try {
      form = await c.req.formData()
    } catch {
      return c.json({ error: 'Expected multipart form data.' }, 400)
    }

    const upload = checkPdfUpload(form.get('file'))
    if (!upload.ok) return c.json({ error: upload.error }, upload.status)

    const p12 = form.get('p12')
    if (!(p12 instanceof File) || p12.size === 0) {
      return c.json({ error: 'Choose a .p12 or .pfx certificate file.' }, 400)
    }
    if (p12.size > MAX_P12_BYTES) {
      return c.json({ error: 'The certificate file must be 2 MB or smaller.' }, 413)
    }

    const permissionRaw = String(form.get('permission') ?? '1')
    const permission: MdpPermission = permissionRaw === '2' ? 2 : 1

    try {
      const inputBytes = Buffer.from(await upload.file.arrayBuffer())
      if (inputBytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        return c.json({ error: 'That file does not look like a PDF.' }, 400)
      }

      const outputBytes = await certifyPdf(inputBytes, {
        p12: Buffer.from(await p12.arrayBuffer()),
        passphrase: String(form.get('passphrase') ?? ''),
        name: String(form.get('name') ?? '').slice(0, 200),
        reason: String(form.get('reason') ?? '').slice(0, 500),
        location: String(form.get('location') ?? '').slice(0, 200),
        permission,
      })

      return c.body(outputBytes, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="certified.pdf"',
        'X-Original-Size': String(inputBytes.length),
        'X-Certified-Size': String(outputBytes.length),
        'X-Certification-Level': String(permission),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Certification failed.'
      console.error('[certify]', message)
      return c.json({ error: message }, 400)
    }
  },
)

// In production, serve the built Vite app from the same process. In development,
// Vite handles the frontend and proxies /api here.
app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

console.log(`Sheet API listening on http://localhost:${PORT}`)
console.log(`Allowed CORS origins: ${CORS_ORIGINS.join(', ')}`)
serve({ fetch: app.fetch, port: PORT })
