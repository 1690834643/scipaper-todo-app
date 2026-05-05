const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripXmlTags(text) {
  return decodeXmlEntities(text.replace(/<[^>]+>/g, '')).trim();
}

function shouldSkipDocxParagraph(paragraphXml, plainText) {
  if (/<w:instrText[\s\S]*?\bTOC\b/i.test(paragraphXml)) return true;
  if (/__RefHeading___Toc/i.test(paragraphXml)) return true;
  if (/\bHYPERLINK\s+\\l\s+"?__RefHeading/i.test(plainText)) return true;
  if (/^TOC\s+\\/i.test(plainText)) return true;
  return false;
}

function readZipEntry(buffer, wantedName) {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buffer.slice(nameStart, nameStart + fileNameLength).toString('utf-8');
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (name === wantedName) {
      const data = buffer.slice(dataStart, dataEnd);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`Unsupported docx compression method: ${method}`);
    }

    if (flags & 0x08) {
      throw new Error('Unsupported docx zip entry with data descriptor');
    }
    offset = dataEnd;
  }
  return null;
}

function extractDocxText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const documentXml = readZipEntry(buffer, 'word/document.xml');
  if (!documentXml) {
    throw new Error('DOCX 中没有找到 word/document.xml');
  }

  const xml = documentXml.toString('utf-8');
  const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  return paragraphs
    .map((paragraph) => {
      const text = stripXmlTags(paragraph);
      return shouldSkipDocxParagraph(paragraph, text) ? '' : text;
    })
    .filter(Boolean)
    .join('\n\n');
}

function decodePdfLiteralString(raw) {
  return raw
    .replace(/\\([nrtbf()\\])/g, (_match, ch) => {
      if (ch === 'n') return '\n';
      if (ch === 'r') return '\r';
      if (ch === 't') return '\t';
      if (ch === 'b') return '\b';
      if (ch === 'f') return '\f';
      return ch;
    })
    .replace(/\\([0-7]{1,3})/g, (_match, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function extractTextFromPdfStream(streamText) {
  const chunks = [];
  let match;
  const literalTj = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  while ((match = literalTj.exec(streamText)) !== null) {
    chunks.push(decodePdfLiteralString(match[1]));
  }

  const arrayText = /\[((?:\s*\((?:\\.|[^\\)])*\)\s*-?\d*\.?\d*\s*)+)\]\s*TJ/g;
  while ((match = arrayText.exec(streamText)) !== null) {
    const itemText = [];
    const itemRegex = /\(((?:\\.|[^\\)])*)\)/g;
    let item;
    while ((item = itemRegex.exec(match[1])) !== null) {
      itemText.push(decodePdfLiteralString(item[1]));
    }
    if (itemText.length) chunks.push(itemText.join(''));
  }

  return chunks.join('\n');
}

function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const raw = buffer.toString('binary');
  const chunks = [];
  const streamRegex = /(<<[\s\S]*?>>)?\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match;

  while ((match = streamRegex.exec(raw)) !== null) {
    const dictionary = match[1] || '';
    const streamBuffer = Buffer.from(match[2], 'binary');
    let streamText = '';
    try {
      streamText = /\/FlateDecode/.test(dictionary)
        ? zlib.inflateSync(streamBuffer).toString('latin1')
        : streamBuffer.toString('latin1');
    } catch {
      continue;
    }
    const text = extractTextFromPdfStream(streamText);
    if (text.trim()) chunks.push(text);
  }

  const output = chunks.join('\n\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!output) {
    throw new Error('没有从 PDF 中提取到文本。扫描版 PDF 需要 OCR。');
  }
  return output;
}

function extractTextFromFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.docx') return extractDocxText(filePath);
  if (extension === '.pdf') return extractPdfText(filePath);
  if (extension === '.txt' || extension === '.md' || extension === '.markdown') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  throw new Error('暂不支持该文件类型。请使用 .txt、.md、.docx 或文本型 .pdf。');
}

module.exports = {
  extractDocxText,
  extractPdfText,
  extractTextFromFile,
};
