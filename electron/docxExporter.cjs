'use strict';

const path = require('path');
const fs = require('fs');
const { stripHtml } = require('./htmlContent.cjs');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  PageOrientation,
} = require('docx');
const { getArticleById, getArticleDirectory, resolveBlockPath, getItalicGuide } = require('./storage.cjs');
const { simpleComplete } = require('./llmClient.cjs');

const TEMPLATES = [
  { id: 'academic-en', name: '通用学术 (英文)', description: 'Times New Roman 12pt, 1.5 行距, 段首 0.5" 缩进' },
  { id: 'thesis-zh', name: '中文学位论文', description: '宋体 12pt, 1.5 行距, 段首 2 字符缩进' },
  { id: 'nature', name: 'Nature 风格', description: 'Arial 11pt, 单倍行距, 紧凑段间距' },
];

const SPECS = {
  'academic-en': {
    id: 'academic-en',
    font: { ascii: 'Times New Roman' },
    bodySize: 24,
    lineSpacing: { line: 360, lineRule: 'auto', after: 120 },
    firstLineIndentTwips: 720,
    titleSize: 32,
    titleAlign: AlignmentType.CENTER,
    headingSize: 28,
    isZh: false,
  },
  'thesis-zh': {
    id: 'thesis-zh',
    font: { ascii: 'Times New Roman', eastAsia: 'SimSun' },
    bodySize: 24,
    lineSpacing: { line: 360, lineRule: 'auto', after: 120 },
    firstLineIndentTwips: 480,
    titleSize: 36,
    titleAlign: AlignmentType.CENTER,
    headingSize: 28,
    isZh: true,
  },
  nature: {
    id: 'nature',
    font: { ascii: 'Arial' },
    bodySize: 22,
    lineSpacing: { line: 240, lineRule: 'auto', after: 100 },
    firstLineIndentTwips: 0,
    titleSize: 28,
    titleAlign: AlignmentType.LEFT,
    headingSize: 23,
    isZh: false,
  },
};

const SECTION_LABELS_EN = {
  Title: 'Title',
  Abstract: 'Abstract',
  Introduction: 'Introduction',
  MaterialsAndMethods: 'Materials and Methods',
  Results: 'Results',
  Discussion: 'Discussion',
  References: 'References',
};

const SECTION_LABELS_ZH = {
  Title: '标题',
  Abstract: '摘要',
  Introduction: '前言',
  MaterialsAndMethods: '材料与方法',
  Results: '结果',
  Discussion: '讨论',
  References: '参考文献',
};

function pickTemplate(id) {
  return SPECS[id] || SPECS['academic-en'];
}

function fontProps(spec) {
  return { ascii: spec.font.ascii, eastAsia: spec.font.eastAsia || spec.font.ascii };
}

// 与 latexExporter 共享的 [@key] 引用模式。docx 没原生 cite 字段，落地为
// 文本「[作者 年份]」或退回到字面 [@key]，由 buildCiteMap 决定。
const CITE_PATTERN = /\[@([A-Za-z][\w:.-]*)\]/g;

function extractCiteKey(bibtex) {
  const m = String(bibtex || '').match(/@\w+\s*\{\s*([^,\s]+)/);
  return m ? m[1] : null;
}

function firstAuthorLastName(authors) {
  if (!authors) return '';
  const trimmed = String(authors).trim();
  if (!trimmed) return '';
  // 支持「Smith, John; Doe, Jane」「J. Smith and J. Doe」「张三, 李四」三种常见输入。
  const first = trimmed.split(/\s+and\s+|;|,(?=\s*[A-Z])/)[0].trim();
  if (!first) return '';
  if (first.includes(',')) {
    return first.split(',')[0].trim();
  }
  const tokens = first.split(/\s+/);
  return tokens[tokens.length - 1] || first;
}

function buildCiteMap(citations) {
  const map = new Map();
  if (!Array.isArray(citations)) return map;
  citations.forEach((c, idx) => {
    const key = extractCiteKey(c.bibtex) || c.id || `ref${idx + 1}`;
    if (!key || map.has(key)) return;
    const name = firstAuthorLastName(c.authors);
    const year = c.year ? String(c.year).trim() : '';
    let display;
    if (name && year) display = `[${name} ${year}]`;
    else if (name) display = `[${name}]`;
    else if (year) display = `[${year}]`;
    else if (c.title) display = `[${String(c.title).split(/\s+/).slice(0, 4).join(' ')}]`;
    else display = `[${key}]`;
    map.set(key, display);
  });
  return map;
}

// Parse inline markdown italics (`*x*` or `_x_`) into TextRun-compatible segments.
// Skips `**bold**`, `__bold__`, escaped `\*`. Single-line input.
function parseInlineItalic(line) {
  if (!line) return [{ text: '', italics: false }];
  const segments = [];
  let buf = '';
  let i = 0;
  const flush = (italics) => {
    if (buf) segments.push({ text: buf, italics });
    buf = '';
  };
  while (i < line.length) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) {
      buf += line[i + 1];
      i += 2;
      continue;
    }
    if ((ch === '*' || ch === '_') && line[i + 1] === ch) {
      // bold marker — skip both chars literally
      buf += ch + ch;
      i += 2;
      continue;
    }
    if (ch === '*' || ch === '_') {
      const close = line.indexOf(ch, i + 1);
      // Reject if no close, immediate close (empty), or close starts a bold pair (**)
      if (close === -1 || close === i + 1 || line[close + 1] === ch) {
        buf += ch;
        i += 1;
        continue;
      }
      const inner = line.slice(i + 1, close);
      // Reject if inner contains the same delimiter (nested) or newline
      if (inner.includes(ch) || inner.includes('\n')) {
        buf += ch;
        i += 1;
        continue;
      }
      flush(false);
      segments.push({ text: inner, italics: true });
      i = close + 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flush(false);
  return segments.length ? segments : [{ text: '', italics: false }];
}

function runsForLine(line, spec, citeMap) {
  // 拆分 [@key]：cite 段独立成 TextRun（带方括号显示），其余文本走
  // parseInlineItalic 保留 italic 处理。docx 没有原生 cite 字段，落地为
  // 文本「[作者 年份]」或回退到 [@key]。
  const cites = citeMap instanceof Map ? citeMap : null;
  const segments = [];
  let lastIdx = 0;
  let m;
  CITE_PATTERN.lastIndex = 0;
  while ((m = CITE_PATTERN.exec(line)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ kind: 'text', value: line.slice(lastIdx, m.index) });
    }
    segments.push({ kind: 'cite', key: m[1] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < line.length) {
    segments.push({ kind: 'text', value: line.slice(lastIdx) });
  }
  if (segments.length === 0) {
    segments.push({ kind: 'text', value: line || '' });
  }

  const runs = [];
  for (const seg of segments) {
    if (seg.kind === 'cite') {
      const display = cites && cites.has(seg.key) ? cites.get(seg.key) : `[@${seg.key}]`;
      runs.push(
        new TextRun({
          text: display,
          font: fontProps(spec),
          size: spec.bodySize,
        }),
      );
    } else {
      for (const sub of parseInlineItalic(seg.value)) {
        runs.push(
          new TextRun({
            text: sub.text,
            italics: sub.italics || undefined,
            font: fontProps(spec),
            size: spec.bodySize,
          }),
        );
      }
    }
  }
  return runs;
}

function bodyParagraph(text, spec, extraIndent, citeMap) {
  const lines = String(text || '').split('\n');
  return lines.map((line) =>
    new Paragraph({
      children: runsForLine(line, spec, citeMap),
      spacing: spec.lineSpacing,
      indent: extraIndent !== undefined ? extraIndent : { firstLine: spec.firstLineIndentTwips },
    })
  );
}

const ITALIC_OUTPUT_INSTRUCTION =
  '\n\n输出要求:\n' +
  '- 仅返回标注好斜体的原文(将该斜体的内容用 markdown *text* 包裹)\n' +
  '- 不要任何解释、前缀、后缀、代码块包裹\n' +
  '- 保留原文所有换行、空格、标点不变\n' +
  '- 原文已含 *...* 的位置照常保留,不要改造\n' +
  '- 不要新增/删除/改写任何文字,仅在该斜体的词周围加 *';

async function applyItalicMarks(text, guidePrompt, providerId, signal) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return text;
  try {
    const out = await simpleComplete({
      providerId,
      system: String(guidePrompt || '') + ITALIC_OUTPUT_INSTRUCTION,
      userMessage: '原文:\n' + text,
      signal,
      maxTokens: 8000,
    });
    const cleaned = String(out || '').trim();
    if (!cleaned) return text;
    // Length sanity: refuse if model expanded/shrank more than 60% (likely hallucinated)
    const ratio = cleaned.length / Math.max(trimmed.length, 1);
    if (ratio < 0.4 || ratio > 2.5) return text;
    return cleaned;
  } catch (_e) {
    return text;
  }
}

async function buildItalicMarkMap(article, signal) {
  const guide = getItalicGuide();
  if (!guide?.enabled || !guide.prompt) return new Map();
  const map = new Map();
  const jobs = [];
  for (const section of article.sections || []) {
    for (const block of section.contentBlocks || []) {
      if ((block.type || '').toLowerCase() !== 'text') continue;
      const id = block.id;
      jobs.push(
        applyItalicMarks(stripHtml(block.content || ''), guide.prompt, undefined, signal).then((marked) => {
          map.set(id, marked);
        })
      );
    }
  }
  await Promise.all(jobs);
  return map;
}

function italicParagraph(text, spec, size) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        italics: true,
        font: fontProps(spec),
        size: size || spec.bodySize,
      }),
    ],
    spacing: spec.lineSpacing,
  });
}

function buildDocument(article, spec, italicMap) {
  const children = [];
  const marks = italicMap instanceof Map ? italicMap : new Map();
  const citeMap = buildCiteMap(article.citations);

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: article.title || 'Untitled Manuscript',
          bold: true,
          font: fontProps(spec),
          size: spec.titleSize,
        }),
      ],
      alignment: spec.titleAlign,
      spacing: { after: 200 },
    })
  );

  const journalLine = [
    article.targetJournal ? `Journal: ${article.targetJournal}` : '',
    article.status ? `Status: ${article.status}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');

  if (journalLine) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: journalLine,
            italics: true,
            font: fontProps(spec),
            size: 20,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      })
    );
  }

  const rcHeading = spec.isZh ? '研究上下文' : 'Research Context';
  children.push(
    new Paragraph({
      text: rcHeading,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
    })
  );

  const rc = article.researchContext || {};
  const bullets = spec.isZh
    ? [
        ['科学问题', rc.scientificQuestion],
        ['观察现象', rc.observedPhenomenon],
        ['假设', rc.hypothesis],
        ['研究方案', rc.approach],
      ]
    : [
        ['Scientific question', rc.scientificQuestion],
        ['Observed phenomenon', rc.observedPhenomenon],
        ['Hypothesis', rc.hypothesis],
        ['Approach', rc.approach],
      ];

  for (const [label, value] of bullets) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `• ${label}: ${value || ''}`,
            font: fontProps(spec),
            size: spec.bodySize,
          }),
        ],
        spacing: spec.lineSpacing,
      })
    );
  }

  const labelMap = spec.isZh ? SECTION_LABELS_ZH : SECTION_LABELS_EN;
  const sections = [...(article.sections || [])].sort((a, b) => a.orderIndex - b.orderIndex);

  for (const section of sections) {
    const headingLabel = labelMap[section.type] || section.type;
    const isReferences = section.type === 'References';

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: headingLabel,
            bold: true,
            font: fontProps(spec),
            size: spec.headingSize,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 160 },
      })
    );

    const blocks = [...(section.contentBlocks || [])].sort((a, b) => a.orderIndex - b.orderIndex);

    if (blocks.length === 0) {
      children.push(italicParagraph(spec.isZh ? '（暂无内容）' : '(no content)', spec));
      continue;
    }

    for (const block of blocks) {
      const blockType = (block.type || '').toLowerCase();

      if (blockType === 'text') {
        // block.content is HTML since v1.0.47; render plain prose for docx.
        const content = marks.has(block.id) ? marks.get(block.id) : stripHtml(block.content || '');
        const indent = isReferences ? { left: 720, hanging: 720 } : { firstLine: spec.firstLineIndentTwips };
        const paras = bodyParagraph(content, spec, indent, citeMap);
        children.push(...paras);
      } else if (blockType === 'image') {
        let added = false;
        const filePath = resolveBlockPath(article.id, block);
        if (filePath) {
          try {
            const buf = fs.readFileSync(filePath);
            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: buf,
                    transformation: { width: 400, height: 300 },
                  }),
                ],
                spacing: { after: 120 },
              })
            );
            added = true;
          } catch (_e) {
            added = false;
          }
        }
        if (!added) {
          children.push(italicParagraph(`[Image: ${block.fileName || path.basename(block.content || '') || 'image'}]`, spec));
        }
        if (block.description) {
          children.push(italicParagraph(block.description, spec, 18));
        }
      } else {
        children.push(italicParagraph(`[Attachment: ${block.fileName || path.basename(block.content || '') || ''}]`, spec));
        if (block.description) {
          children.push(italicParagraph(block.description, spec, 18));
        }
      }
    }
  }

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });
}

async function exportArticleDocx(articleId, templateId, options = {}) {
  const article = getArticleById(articleId);
  if (!article) throw new Error('Article not found: ' + articleId);
  const spec = pickTemplate(templateId);
  const italicMap = options.applyItalicGuide ? await buildItalicMarkMap(article, options.signal) : new Map();
  const doc = buildDocument(article, spec, italicMap);
  const buf = await Packer.toBuffer(doc);
  const articleDir = getArticleDirectory(articleId);
  const exportDir = path.join(articleDir, 'Exports');
  fs.mkdirSync(exportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTitle =
    (article.title || 'manuscript').replace(/[^\w一-龥-]+/g, '-').replace(/^-+|-+$/g, '') || 'manuscript';
  const outPath = path.join(exportDir, `${safeTitle}-${spec.id}-${stamp}.docx`);
  fs.writeFileSync(outPath, buf);
  return outPath;
}

module.exports = { TEMPLATES, exportArticleDocx, parseInlineItalic, applyItalicMarks };
