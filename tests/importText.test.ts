import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { extractTextFromFile } = require('../electron/importText.cjs') as {
  extractTextFromFile: (filePath: string) => string
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeDocxBuffer(xml: string): Buffer {
  const fileName = Buffer.from('word/document.xml')
  const raw = Buffer.from(xml)
  const compressed = zlib.deflateRawSync(raw)
  const checksum = crc32(raw)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(checksum, 14)
  local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(raw.length, 22)
  local.writeUInt16LE(fileName.length, 26)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(checksum, 16)
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(raw.length, 24)
  central.writeUInt16LE(fileName.length, 28)

  const localRecord = Buffer.concat([local, fileName, compressed])
  const centralRecord = Buffer.concat([central, fileName])

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(centralRecord.length, 12)
  end.writeUInt32LE(localRecord.length, 16)

  return Buffer.concat([localRecord, centralRecord, end])
}

describe('import text extraction', () => {
  it('extracts paragraph text from a docx file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scipaper-docx-'))
    const filePath = path.join(dir, 'draft.docx')
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p><w:r><w:t>Abstract</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Stress response text.</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Reviewer 1</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Comment 1: Clarify the gap.</w:t></w:r></w:p>',
      '</w:body>',
      '</w:document>',
    ].join('')
    fs.writeFileSync(filePath, makeDocxBuffer(xml))

    try {
      expect(extractTextFromFile(filePath)).toContain('Stress response text.')
      expect(extractTextFromFile(filePath)).toContain('Comment 1: Clarify the gap.')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('filters docx table-of-contents field code paragraphs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scipaper-docx-toc-'))
    const filePath = path.join(dir, 'draft-with-toc.docx')
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p><w:r><w:instrText>TOC \\f \\o &quot;1-9&quot; \\h</w:instrText></w:r></w:p>',
      '<w:p><w:hyperlink w:anchor="__RefHeading___Toc722_3880586226"><w:r><w:t>摘要</w:t></w:r></w:hyperlink><w:r><w:t>I</w:t></w:r></w:p>',
      '<w:p><w:hyperlink w:anchor="__RefHeading___Toc726_3880586226"><w:r><w:t>1. 绪论</w:t></w:r></w:hyperlink><w:r><w:t>1</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>摘要</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>这是正式摘要内容。</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>1. 绪论</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>这是正式绪论内容。</w:t></w:r></w:p>',
      '</w:body>',
      '</w:document>',
    ].join('')
    fs.writeFileSync(filePath, makeDocxBuffer(xml))

    try {
      const text = extractTextFromFile(filePath)
      expect(text).not.toContain('TOC \\f')
      expect(text).not.toContain('HYPERLINK')
      expect(text).not.toContain('__RefHeading')
      expect(text).toContain('这是正式摘要内容。')
      expect(text).toContain('这是正式绪论内容。')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('extracts literal text from a text-based pdf file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scipaper-pdf-'))
    const filePath = path.join(dir, 'review.pdf')
    const pdf = [
      '%PDF-1.4',
      '1 0 obj',
      '<< /Length 72 >>',
      'stream',
      'BT',
      '(Reviewer 1) Tj',
      '(Comment 1: Clarify the Introduction.) Tj',
      'ET',
      'endstream',
      'endobj',
      '%%EOF',
    ].join('\n')
    fs.writeFileSync(filePath, pdf, 'binary')

    try {
      expect(extractTextFromFile(filePath)).toContain('Reviewer 1')
      expect(extractTextFromFile(filePath)).toContain('Clarify the Introduction.')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('extracts multiple text import files with source names', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scipaper-multi-import-'))
    const first = path.join(dir, 'results.md')
    const second = path.join(dir, 'discussion.txt')
    fs.writeFileSync(first, '## Results\n\nResult text.', 'utf-8')
    fs.writeFileSync(second, '## Discussion\n\nDiscussion text.', 'utf-8')

    try {
      const { extractTextFromFiles } = require('../electron/importText.cjs') as {
        extractTextFromFiles: (filePaths: string[]) => Array<{ filePath: string; fileName: string; text: string }>
      }
      expect(extractTextFromFiles([first, second]).map((file) => file.fileName)).toEqual(['results.md', 'discussion.txt'])
      expect(extractTextFromFiles([first, second]).map((file) => file.text)).toEqual([
        '## Results\n\nResult text.',
        '## Discussion\n\nDiscussion text.',
      ])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
