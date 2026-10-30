import { SignPdf } from '@signpdf/signpdf'
import { P12Signer } from '@signpdf/signer-p12'
import { PDFDocument } from 'pdf-lib'
import { addSignaturePlaceholder, type MdpPermission } from './placeholder'

export interface CertifyOptions {
  p12: Buffer
  passphrase: string
  name: string
  reason: string
  location: string
  permission: MdpPermission
}

const pdfSigner = new SignPdf()

function friendlySigningError(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''

  if (/mac could not be verified|invalid password|passphrase/i.test(message)) {
    return new Error('The certificate passphrase is incorrect.')
  }
  if (/matches the private key|private key/i.test(message)) {
    return new Error('This .p12/.pfx file does not contain a usable private key.')
  }
  if (/pkcs12|p12 certificate|asn1|der/i.test(message)) {
    return new Error(
      'Could not read this .p12/.pfx file. Export it as a PKCS#12 certificate with its private key.',
    )
  }
  if (/placeholder length/i.test(message)) {
    return new Error(
      'The certificate chain is too large to embed. Try a .p12 with fewer intermediate certificates.',
    )
  }

  return new Error(`Signing failed: ${message || 'unknown error'}`)
}

export async function certifyPdf(input: Buffer, options: CertifyOptions): Promise<Buffer> {
  if (input.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('That file does not look like a PDF.')
  }

  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/encrypt/i.test(message)) {
      throw new Error(
        'This PDF is password-protected. Remove the existing password before certifying it.',
      )
    }
    throw new Error('Could not read this PDF. It may be corrupted.')
  }

  if (doc.getPageCount() === 0) {
    throw new Error('This PDF has no pages to certify.')
  }

  const name = options.name.trim() || 'Sheet signer'
  const reason = options.reason.trim() || 'Certified with Sheet'

  addSignaturePlaceholder({
    pdfDoc: doc,
    pdfPage: doc.getPage(0),
    name,
    reason,
    location: options.location.trim(),
    certify: { permission: options.permission },
  })

  const unsigned = Buffer.from(await doc.save({ useObjectStreams: false }))

  try {
    const signer = new P12Signer(options.p12, { passphrase: options.passphrase })
    const signed = await pdfSigner.sign(unsigned, signer)
    return Buffer.from(signed)
  } catch (error) {
    throw friendlySigningError(error)
  }
}
