// Deterministic e-KTP parser. No I/O, no logging, does not return raw OCR text.
import { nikMismatches, parseNik, type KtpField } from '../nik'

export type KtpDraft = {
  nik?: string
  name?: string
  dob?: string
  birthPlace?: string
  sex?: 'laki_laki' | 'perempuan'
  bloodType?: string
  address?: string
  rtRw?: string
  village?: string
  districtName?: string
  religion?: string
  marital?: string
  job?: string
  citizenship?: string
  validUntil?: string
  provinceName?: string
  regencyName?: string
  province?: string
  regency?: string
  district?: string
}

export type OcrFlag = { field: KtpField | 'nik' | 'name' | 'address'; kind: 'low' | 'mismatch' }
export type WordConf = { text: string; confidence: number }

/** O→0, I/l→1, B→8, S→5, then keep digits only. */
export function fixNikDigits(raw: string): string {
  // L is included because we often uppercase OCR text before repair (I/l → 1).
  return raw
    .replace(/O/gi, '0')
    .replace(/[Il]/gi, '1')
    .replace(/B/g, '8')
    .replace(/S/gi, '5')
    .replace(/\D/g, '')
}

function parseIdDate(s: string): string | undefined {
  const m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (!m) return
  const d = +m[1], mo = +m[2], yRaw = m[3]
  const y = yRaw.length === 2 ? (+yRaw > 30 ? 1900 + +yRaw : 2000 + +yRaw) : +yRaw
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return
  const t = new Date(Date.UTC(y, mo - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseSex(s: string): 'laki_laki' | 'perempuan' | undefined {
  const u = s.toUpperCase().replace(/[^A-Z]/g, ' ')
  // PERENPUAN and similar OCR slips still count as perempuan.
  if (/PERE[MN]PUAN|WANITA/.test(u)) return 'perempuan'
  if (/LAKI|PRIA/.test(u)) return 'laki_laki'
}

function parseBlood(s: string): string | undefined {
  const m = s.toUpperCase().match(/\b(AB|[ABO0])\b/)
  if (!m) return
  return m[1] === '0' ? 'O' : m[1]
}

function parseMarital(s: string): string | undefined {
  const u = s.toUpperCase()
  if (/BELUM\s+KAWIN/.test(u)) return 'BELUM KAWIN'
  if (/CERAI\s+HIDUP/.test(u)) return 'CERAI HIDUP'
  if (/CERAI\s+MATI/.test(u)) return 'CERAI MATI'
  if (/\bKAWIN\b/.test(u)) return 'KAWIN'
  const v = cleanLine(s).split(' ').filter((w) => w.length > 2).slice(0, 2).join(' ')
  return v || undefined
}

function parseValidUntil(s: string): string | undefined {
  const u = s.toUpperCase().replace(/\s+/g, ' ').trim()
  const seumur = u.match(/SEUMUR\s+HIDUP/)
  if (seumur) return 'SEUMUR HIDUP'
  const d = parseIdDate(u)
  if (d) return d
  const v = cleanLine(u)
  return v || undefined
}

function cleanLine(s: string): string {
  return s
    .replace(/^[\s:.\-–—]+/, '')
    .replace(/[^\p{L}\p{N} /.,\-']/gu, ' ')
    .replace(/\bKARTU TANDA PENDUDUK\b.*$/i, '')
    .replace(/\bREPUBLIK INDONESIA\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanName(s: string): string | undefined {
  const v = s.replace(/[^A-Za-zÀ-ÿ'’.\- ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (v.length < 3 || !/[A-Za-zÀ-ÿ]/.test(v)) return
  return v
}

function cleanAddress(s: string): string | undefined {
  const v = cleanLine(s).replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, '').replace(/\s+/g, ' ').trim()
  return v.length >= 3 ? v : undefined
}

// Label anchors for a standard e-KTP (order matters when two regexes could match).
const ANCHORS: { key: string; re: RegExp }[] = [
  { key: 'provinceName', re: /PROVINSI\b/g },
  { key: 'regencyName', re: /KABUPATEN(?:\s*\/\s*KOTA)?|\bKOTA\b/g },
  { key: 'nik', re: /\bN[I1]K\b/g },
  { key: 'name', re: /\bNAMA\b/g },
  { key: 'birth', re: /TEMPAT\s*\/?\s*TGL\.?\s*LAHIR/g },
  { key: 'sex', re: /JENIS\s*KELAMIN/g },
  { key: 'blood', re: /GOL\.?\s*DARAH/g },
  { key: 'address', re: /\bALAMAT\b/g },
  { key: 'rtrw', re: /RT\s*\/?\s*RW/g },
  { key: 'village', re: /KEL(?:URAHAN)?\s*\/?\s*DESA/g },
  { key: 'districtName', re: /\bKECAMATAN\b/g },
  { key: 'religion', re: /\bAGAMA\b/g },
  { key: 'marital', re: /STATUS\s*PERKAWINAN/g },
  { key: 'job', re: /\bPEKERJAAN\b/g },
  { key: 'citizen', re: /KEWARGANEGARAAN/g },
  { key: 'validUntil', re: /BERLAKU\s*HINGGA/g },
]

function slices(upper: string): Record<string, string> {
  const hits: { key: string; start: number; end: number }[] = []
  for (const { key, re } of ANCHORS) {
    re.lastIndex = 0
    const m = re.exec(upper)
    if (m) hits.push({ key, start: m.index, end: m.index + m[0].length })
  }
  hits.sort((a, b) => a.start - b.start)
  const out: Record<string, string> = {}
  for (let i = 0; i < hits.length; i++) {
    const stop = i + 1 < hits.length ? hits[i + 1].start : upper.length
    out[hits[i].key] = upper.slice(hits[i].end, stop).replace(/^[\s:.\-]+/, '').replace(/\s+/g, ' ').trim()
  }
  return out
}

function nikCandidates(text: string, labeled?: string): string[] {
  const out: string[] = []
  const consider = (raw: string) => {
    const d = fixNikDigits(raw)
    if (d.length === 16) out.push(d)
    else if (d.length > 16) {
      for (let i = 0; i <= d.length - 16; i++) out.push(d.slice(i, i + 16))
    }
  }
  if (labeled) consider(labeled)
  // Almost-NIK tokens only (digit-like, optional spaces). Neighbouring words like BUDI (B→8) are not consumed.
  const almost = /[0-9OIlSBoils][0-9OIlSBoils\s]{14,22}/g
  for (const src of [labeled ?? '', text]) {
    almost.lastIndex = 0
    for (const m of src.match(almost) ?? []) consider(m)
  }
  return [...new Set(out)]
}

function fieldConfidence(words: WordConf[] | undefined, tokens: (string | undefined)[]): number | undefined {
  if (!words?.length) return
  const needles = tokens.filter(Boolean).map((t) => t!.toUpperCase()).join(' ').split(/\s+/).filter((w) => w.length >= 2)
  if (!needles.length) return
  const hits = words.filter((w) => needles.includes(w.text.toUpperCase().replace(/[^A-Z0-9]/g, '')))
  if (!hits.length) return
  return hits.reduce((s, w) => s + w.confidence, 0) / hits.length
}

/** Parse standard e-KTP OCR text into a draft. Cross-checks gender, DOB, and region codes with parseNik. */
export function parseKtpText(text: string, words?: WordConf[]): { draft: KtpDraft; flags: OcrFlag[] } {
  const upper = text.toUpperCase()
  const part = slices(upper)
  const flags: OcrFlag[] = []
  const draft: KtpDraft = {}

  const cands = nikCandidates(text, part.nik)
  const picked = cands.filter((n) => parseNik(n))[0] ?? cands.find((n) => n.length === 16)
  if (picked) draft.nik = picked
  const hadLetterConfusion = !!picked && !text.replace(/\D/g, '').includes(picked)
  const almostNik = /[0-9OIlSBoils][0-9OIlSBoils\s]{14,22}/g
  const slicedNik = !!picked && [part.nik ?? '', text].some((src) => {
    almostNik.lastIndex = 0
    for (const m of src.matchAll(almostNik)) {
      const d = fixNikDigits(m[0])
      if (d.length > 16 && d.includes(picked)) return true
    }
    return false
  })

  const name = cleanName(part.name ?? '')
  if (name) draft.name = name

  const birth = part.birth ?? ''
  const dobOcr = parseIdDate(birth)
  if (dobOcr) draft.dob = dobOcr

  const sexOcr = parseSex(part.sex ?? '')
  if (sexOcr) draft.sex = sexOcr

  // Alamat often continues onto RT/RW; keep the address line only.
  const address = cleanAddress(part.address ?? '')
  if (address) draft.address = address

  const blood = parseBlood(part.blood ?? '')
  if (blood) draft.bloodType = blood
  const place = cleanLine((birth.split(',')[0] ?? ''))
  if (place && !parseIdDate(place)) draft.birthPlace = place
  const rtRw = cleanLine(part.rtrw ?? '').replace(/\s+/g, '')
  if (/\d{1,3}\s*\/?\s*\d{1,3}/.test(rtRw)) draft.rtRw = rtRw.replace(/(\d)\s*\/\s*(\d)/, '$1/$2')
  const village = cleanLine(part.village ?? '')
  if (village) draft.village = village
  const districtName = cleanLine(part.districtName ?? '')
  if (districtName) draft.districtName = districtName
  const religion = cleanLine(part.religion ?? '')
  if (religion) draft.religion = religion
  const marital = parseMarital(part.marital ?? '')
  if (marital) draft.marital = marital
  // Issue date printed under the photo must not attach to the job line.
  const job = cleanLine(part.job ?? '').replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, '').trim()
  if (job) draft.job = job
  const citizenship = cleanLine(part.citizen ?? '')
  if (citizenship) draft.citizenship = citizenship
  const validUntil = parseValidUntil(part.validUntil ?? '')
  if (validUntil) draft.validUntil = validUntil
  const provinceName = cleanLine(part.provinceName ?? '')
  if (provinceName) draft.provinceName = provinceName
  const regencyName = cleanLine(part.regencyName ?? '').replace(/^KOTA\s+/, '')
  if (regencyName) draft.regencyName = regencyName

  const parsed = picked ? parseNik(picked) : null
  if (parsed) {
    draft.province = parsed.province
    draft.regency = parsed.regency
    draft.district = parsed.district
    if (!draft.dob) draft.dob = parsed.dob
    if (!draft.sex) draft.sex = parsed.sex
    for (const k of nikMismatches(picked, { dob: draft.dob, sex: draft.sex })) {
      flags.push({ field: k, kind: 'mismatch' })
    }
  } else if (picked || part.nik) {
    flags.push({ field: 'nik', kind: 'low' })
  }

  if ((hadLetterConfusion || slicedNik) && picked) flags.push({ field: 'nik', kind: 'low' })
  if (name && (name.length < 4 || /\d/.test(name))) flags.push({ field: 'name', kind: 'low' })

  const lowAt = (field: OcrFlag['field'], tokens: (string | undefined)[]) => {
    const c = fieldConfidence(words, tokens)
    if (c !== undefined && c < 60 && !flags.some((f) => f.field === field && f.kind === 'low')) {
      flags.push({ field, kind: 'low' })
    }
  }
  lowAt('nik', [draft.nik])
  lowAt('name', draft.name?.split(' ') ?? [])
  lowAt('dob', [draft.dob, birth])
  lowAt('address', draft.address?.split(' ') ?? [])

  return { draft, flags }
}
