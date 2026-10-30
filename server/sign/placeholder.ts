import {
  PDFArray,
  PDFDict,
  type PDFDocument,
  PDFHexString,
  PDFInvalidObject,
  PDFName,
  PDFNumber,
  type PDFPage,
  PDFRef,
  PDFString,
} from 'pdf-lib'

/**
 * Adapted from @signpdf/placeholder-pdf-lib (MIT).
 *
 * The upstream helper does not write a DocMDP reference, so certification
 * signatures are impossible with it. This version adds the transform
 * parameters and the catalog's /Perms entry required by ISO 32000.
 */

const DEFAULT_SIGNATURE_LENGTH = 16384
const BYTE_RANGE_PLACEHOLDER = '**********'
const ANNOTATION_FLAG_PRINT = 4
const SIG_FLAG_SIGNATURES_EXIST = 1
const SIG_FLAG_APPEND_ONLY = 2

export type MdpPermission = 1 | 2 | 3

export interface SignaturePlaceholderOptions {
  pdfDoc: PDFDocument
  pdfPage?: PDFPage
  name: string
  reason: string
  location?: string
  contactInfo?: string
  signingTime?: Date
  signatureLength?: number
  widgetRect?: [number, number, number, number]
  appName?: string
  certify?: {
    permission: MdpPermission
  }
}

function fieldNameOf(dict: PDFDict): string | null {
  const value = dict.lookupMaybe(PDFName.of('T'), PDFString, PDFHexString)
  return value ? value.decodeText() : null
}

function walkFields(
  doc: PDFDocument,
  fields: PDFArray,
  visit: (dict: PDFDict) => void,
): void {
  for (const item of fields.asArray()) {
    const dict = item instanceof PDFRef ? doc.context.lookup(item, PDFDict) : item
    if (!(dict instanceof PDFDict)) continue
    visit(dict)

    const kids = dict.lookupMaybe(PDFName.of('Kids'), PDFArray)
    if (kids) walkFields(doc, kids, visit)
  }
}

function hasExistingSignature(doc: PDFDocument): boolean {
  const acroForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
  if (!acroForm) return false

  const fields = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray)
  if (!fields) return false

  let found = false
  walkFields(doc, fields, (dict) => {
    const type = dict.get(PDFName.of('FT'))
    if (type instanceof PDFName && type.asString() === '/Sig') found = true
  })
  return found
}

function usedFieldNames(doc: PDFDocument): Set<string> {
  const names = new Set<string>()
  const acroForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
  const fields = acroForm?.lookupMaybe(PDFName.of('Fields'), PDFArray)
  if (fields) {
    walkFields(doc, fields, (dict) => {
      const name = fieldNameOf(dict)
      if (name) names.add(name)
    })
  }
  return names
}

function nextFieldName(doc: PDFDocument): string {
  const used = usedFieldNames(doc)
  let index = 1
  while (used.has(`Signature${index}`)) index += 1
  return `Signature${index}`
}

export function addSignaturePlaceholder(options: SignaturePlaceholderOptions): void {
  const {
    pdfDoc,
    name,
    reason,
    location = '',
    contactInfo = '',
    signingTime = new Date(),
    signatureLength = DEFAULT_SIGNATURE_LENGTH,
    widgetRect = [0, 0, 0, 0],
    appName = 'Sheet',
    certify,
  } = options

  const page = options.pdfPage ?? pdfDoc.getPages()[0]
  if (!page) throw new Error('This PDF has no pages to sign.')

  if (certify) {
    if (hasExistingSignature(pdfDoc)) {
      throw new Error(
        'This PDF already has a signature. Certification must be the first signature in the document.',
      )
    }
    if (pdfDoc.catalog.lookupMaybe(PDFName.of('Perms'), PDFDict)) {
      throw new Error('This PDF already has a certification or permissions dictionary.')
    }
  }

  const byteRange = PDFArray.withContext(pdfDoc.context)
  byteRange.push(PDFNumber.of(0))
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER))
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER))
  byteRange.push(PDFName.of(BYTE_RANGE_PLACEHOLDER))

  const contents = PDFHexString.of(String.fromCharCode(0).repeat(signatureLength))

  const signatureDict = pdfDoc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: byteRange,
    Contents: contents,
    Reason: PDFString.of(reason),
    M: PDFString.fromDate(signingTime),
    ContactInfo: PDFString.of(contactInfo),
    Name: PDFString.of(name),
    Location: PDFString.of(location),
    ...(certify
      ? {
          Reference: [
            {
              Type: 'SigRef',
              TransformMethod: 'DocMDP',
              TransformParams: {
                Type: 'TransformParams',
                V: '1.2',
                P: certify.permission,
              },
            },
          ],
        }
      : {}),
    Prop_Build: {
      Filter: { Name: 'Adobe.PPKLite' },
      App: { Name: appName },
    },
  })

  // Serialize the signature dictionary verbatim so pdf-lib cannot place it in
  // an object stream. The signing step needs a stable byte range.
  const signatureBytes = new Uint8Array(signatureDict.sizeInBytes())
  signatureDict.copyBytesInto(signatureBytes, 0)
  const signatureRef = pdfDoc.context.register(PDFInvalidObject.of(signatureBytes))

  if (certify) {
    pdfDoc.catalog.set(
      PDFName.of('Perms'),
      pdfDoc.context.obj({ DocMDP: signatureRef }),
    )
  }

  const rect = PDFArray.withContext(pdfDoc.context)
  for (const value of widgetRect) rect.push(PDFNumber.of(value))

  const appearance = pdfDoc.context.formXObject([], {
    BBox: widgetRect,
    Resources: {},
  })

  const widgetDict = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: rect,
    V: signatureRef,
    T: PDFString.of(nextFieldName(pdfDoc)),
    F: ANNOTATION_FLAG_PRINT,
    P: page.ref,
    AP: { N: pdfDoc.context.register(appearance) },
  })
  const widgetRef = pdfDoc.context.register(widgetDict)

  let annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
  if (!annotations) {
    annotations = pdfDoc.context.obj([])
  }
  annotations.push(widgetRef)
  page.node.set(PDFName.of('Annots'), annotations)

  let acroForm = pdfDoc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
  if (!acroForm) {
    acroForm = pdfDoc.context.obj({ Fields: [] })
    pdfDoc.catalog.set(PDFName.of('AcroForm'), pdfDoc.context.register(acroForm))
  }

  const existingFlags = acroForm.get(PDFName.of('SigFlags'))
  const flagValue = existingFlags instanceof PDFNumber ? existingFlags.asNumber() : 0
  acroForm.set(
    PDFName.of('SigFlags'),
    PDFNumber.of(flagValue | SIG_FLAG_SIGNATURES_EXIST | SIG_FLAG_APPEND_ONLY),
  )

  const fields = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray)
  if (!fields) throw new Error('Could not create a signature field in this PDF.')
  fields.push(widgetRef)
}
