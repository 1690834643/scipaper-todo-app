'use strict';

const fs = require('fs');
const path = require('path');
const { getArticleById, getArticleDirectory, resolveBlockPath } = require('./storage.cjs');
const { parseInlineItalic } = require('./docxExporter.cjs');
const { stripHtml } = require('./htmlContent.cjs');

const SECTION_LABELS = {
  Title: 'Title',
  Abstract: 'Abstract',
  Introduction: 'Introduction',
  MaterialsAndMethods: 'Materials and Methods',
  Results: 'Results',
  Discussion: 'Discussion',
  References: 'References',
};

function escapeLatex(text) {
  return String(text == null ? '' : text).replace(/[\\{}$&%#_^~]/g, (ch) => {
    switch (ch) {
      case '\\': return '\\textbackslash{}';
      case '{': return '\\{';
      case '}': return '\\}';
      case '$': return '\\$';
      case '&': return '\\&';
      case '%': return '\\%';
      case '#': return '\\#';
      case '_': return '\\_';
      case '^': return '\\textasciicircum{}';
      case '~': return '\\textasciitilde{}';
      default: return ch;
    }
  });
}

function inlineToLatex(line) {
  return parseInlineItalic(line)
    .map((seg) => {
      const escaped = escapeLatex(seg.text);
      return seg.italics ? `\\textit{${escaped}}` : escaped;
    })
    .join('');
}

// Bibtex key 字符集（参考 BibTeX：字母数字 + - _ : .）。在写作中 [@key] 引用
// 会被替换为 \cite{key}；其余文本仍走 inlineToLatex 做 italic + escape。
const CITE_PATTERN = /\[@([A-Za-z][\w:.-]*)\]/g;

function bodyToLatex(line) {
  if (!line) return '';
  const parts = [];
  let lastIdx = 0;
  let m;
  CITE_PATTERN.lastIndex = 0;
  while ((m = CITE_PATTERN.exec(line)) !== null) {
    if (m.index > lastIdx) {
      parts.push(inlineToLatex(line.slice(lastIdx, m.index)));
    }
    parts.push(`\\cite{${m[1]}}`);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < line.length) {
    parts.push(inlineToLatex(line.slice(lastIdx)));
  }
  return parts.join('');
}

function paragraphsToLatex(text) {
  if (!text) return '';
  const paragraphs = String(text).split(/\n{2,}/);
  return paragraphs
    .map((para) => para.split('\n').map(bodyToLatex).join('\\\\\n'))
    .join('\n\n');
}

function hasChinese(s) {
  return /[一-鿿]/.test(s == null ? '' : String(s));
}

function extractBibKey(bibtex) {
  const m = String(bibtex || '').match(/@\w+\s*\{\s*([^,\s]+)/);
  return m ? m[1] : null;
}

// BibTeX 字段值在 {...} 内仍按 LaTeX 解析，未 escape 的 & / % / $ / # / _
// 会在 LaTeX pass 中报错。结构化 fallback 来自用户原文，需主动 escape。
function escapeBibValue(value) {
  return String(value == null ? '' : value).replace(/[\\{}$&%#_^~]/g, (ch) => {
    switch (ch) {
      case '\\': return '\\textbackslash{}';
      case '{': return '\\{';
      case '}': return '\\}';
      case '$': return '\\$';
      case '&': return '\\&';
      case '%': return '\\%';
      case '#': return '\\#';
      case '_': return '\\_';
      case '^': return '\\textasciicircum{}';
      case '~': return '\\textasciitilde{}';
      default: return ch;
    }
  });
}

function fallbackBibtex(citation, key) {
  const fields = [];
  if (citation.title) fields.push(`  title = {${escapeBibValue(citation.title)}}`);
  if (citation.authors) fields.push(`  author = {${escapeBibValue(citation.authors)}}`);
  if (citation.year) fields.push(`  year = {${escapeBibValue(citation.year)}}`);
  if (citation.journal) fields.push(`  journal = {${escapeBibValue(citation.journal)}}`);
  if (citation.volume) fields.push(`  volume = {${escapeBibValue(citation.volume)}}`);
  if (citation.number) fields.push(`  number = {${escapeBibValue(citation.number)}}`);
  if (citation.pages) fields.push(`  pages = {${escapeBibValue(citation.pages)}}`);
  if (citation.publisher) fields.push(`  publisher = {${escapeBibValue(citation.publisher)}}`);
  if (citation.doi) fields.push(`  doi = {${escapeBibValue(citation.doi)}}`);
  if (citation.url) fields.push(`  url = {${escapeBibValue(citation.url)}}`);
  return `@misc{${key},\n${fields.join(',\n')}\n}`;
}

function uniqueKey(used, base) {
  let key = (base || '').trim() || 'ref';
  let final = key;
  let n = 2;
  while (used.has(final)) {
    final = `${key}_${n++}`;
  }
  used.add(final);
  return final;
}

function buildBibFile(citations) {
  const used = new Set();
  const entries = [];
  citations.forEach((c, idx) => {
    const raw = String(c.bibtex || '').trim();
    if (raw) {
      const baseKey = extractBibKey(raw) || `ref${idx + 1}`;
      const finalKey = uniqueKey(used, baseKey);
      const replaced =
        finalKey === baseKey
          ? raw
          : raw.replace(/^(\s*@\w+\s*\{\s*)[^,\s]+/, `$1${finalKey}`);
      entries.push(replaced);
    } else {
      const finalKey = uniqueKey(used, `ref${idx + 1}`);
      entries.push(fallbackBibtex(c, finalKey));
    }
  });
  return entries.join('\n\n') + '\n';
}

function buildLatexDocument(article, opts) {
  const lines = [];
  const compiler = opts.useChinese ? 'xelatex' : 'pdflatex';
  lines.push('% SciPaper Todo - LaTeX export');
  lines.push(`% Compile: ${compiler} (run twice; if a .bib is present, run bibtex/biber between passes)`);
  lines.push('\\documentclass[11pt,a4paper]{article}');
  lines.push('\\usepackage[utf8]{inputenc}');
  lines.push('\\usepackage[T1]{fontenc}');
  lines.push('\\usepackage{graphicx}');
  lines.push('\\usepackage{hyperref}');
  lines.push('\\usepackage{geometry}');
  lines.push('\\geometry{margin=1in}');
  if (opts.useChinese) {
    lines.push('\\usepackage{ctex} % requires xelatex or lualatex');
  }
  lines.push('');
  lines.push(`\\title{${inlineToLatex(article.title || 'Untitled Manuscript')}}`);
  lines.push('\\date{\\today}');
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('\\maketitle');
  lines.push('');

  const metaParts = [];
  if (article.targetJournal) metaParts.push(`Target journal: ${article.targetJournal}`);
  if (article.status) metaParts.push(`Status: ${article.status}`);
  if (metaParts.length) {
    lines.push(`\\noindent\\textit{${escapeLatex(metaParts.join('  |  '))}}`);
    lines.push('');
  }

  const rc = article.researchContext || {};
  const ctx = [
    ['Scientific question', rc.scientificQuestion],
    ['Observed phenomenon', rc.observedPhenomenon],
    ['Hypothesis', rc.hypothesis],
    ['Approach', rc.approach],
  ].filter(([, v]) => v && String(v).trim());
  if (ctx.length) {
    lines.push('\\section*{Research Context}');
    lines.push('\\begin{itemize}');
    for (const [k, v] of ctx) {
      lines.push(`  \\item \\textbf{${escapeLatex(k)}:} ${inlineToLatex(v)}`);
    }
    lines.push('\\end{itemize}');
    lines.push('');
  }

  const sections = [...(article.sections || [])].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const section of sections) {
    if (section.type === 'Title') continue;
    const headingLabel = SECTION_LABELS[section.type] || section.type;
    const isReferences = section.type === 'References';

    if (isReferences && opts.bibFileName) {
      lines.push('\\bibliographystyle{plain}');
      lines.push(`\\bibliography{${opts.bibFileName.replace(/\.bib$/, '')}}`);
      lines.push('');
      continue;
    }

    lines.push(`\\section{${escapeLatex(headingLabel)}}`);
    lines.push('');

    const blocks = [...(section.contentBlocks || [])].sort((a, b) => a.orderIndex - b.orderIndex);
    if (blocks.length === 0) {
      lines.push('% (no content)');
      lines.push('');
      continue;
    }

    for (const block of blocks) {
      const blockType = String(block.type || '').toLowerCase();
      if (blockType === 'text') {
        // block.content is HTML since v1.0.47; render the prose, not the markup.
        const body = paragraphsToLatex(stripHtml(block.content));
        if (body.trim()) {
          lines.push(body);
          lines.push('');
        }
      } else if (blockType === 'image') {
        const filePath = resolveBlockPath(article.id, block);
        if (filePath && fs.existsSync(filePath)) {
          const dest = path.join(opts.bundleDir, path.basename(filePath));
          try {
            fs.copyFileSync(filePath, dest);
            const rel = path.basename(filePath).replace(/\\/g, '/');
            lines.push('\\begin{figure}[ht]');
            lines.push('  \\centering');
            lines.push(`  \\includegraphics[width=0.8\\linewidth]{${rel}}`);
            if (block.description) {
              lines.push(`  \\caption{${inlineToLatex(block.description)}}`);
            }
            lines.push('\\end{figure}');
            lines.push('');
          } catch (_e) {
            lines.push(`% [Image copy failed: ${escapeLatex(block.fileName || '')}]`);
            lines.push('');
          }
        } else {
          lines.push(`% [Image: ${escapeLatex(block.fileName || block.content || 'image')}]`);
          if (block.description) lines.push(`% Caption: ${escapeLatex(block.description)}`);
          lines.push('');
        }
      } else {
        lines.push(`% [Attachment: ${escapeLatex(block.fileName || '')}]`);
        if (block.description) lines.push(`% Caption: ${escapeLatex(block.description)}`);
        lines.push('');
      }
    }
  }

  // If article had no References section but does have citations, emit bibliography at end
  const hadReferencesSection = sections.some((s) => s.type === 'References');
  if (!hadReferencesSection && opts.bibFileName) {
    lines.push('\\bibliographystyle{plain}');
    lines.push(`\\bibliography{${opts.bibFileName.replace(/\.bib$/, '')}}`);
    lines.push('');
  }

  lines.push('\\end{document}');
  return lines.join('\n');
}

function exportArticleLatex(articleId) {
  const article = getArticleById(articleId);
  if (!article) throw new Error('Article not found: ' + articleId);

  const articleDir = getArticleDirectory(articleId);
  const exportDir = path.join(articleDir, 'Exports');
  fs.mkdirSync(exportDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeTitle =
    (article.title || 'manuscript').replace(/[^\w一-龥-]+/g, '-').replace(/^-+|-+$/g, '') ||
    'manuscript';

  const bundleDir = path.join(exportDir, `${safeTitle}-latex-${stamp}`);
  fs.mkdirSync(bundleDir, { recursive: true });

  const citations = article.citations || [];
  let bibFileName = null;
  if (citations.length) {
    bibFileName = 'references.bib';
    fs.writeFileSync(path.join(bundleDir, bibFileName), buildBibFile(citations), 'utf-8');
  }

  const useChinese =
    hasChinese(article.title) ||
    (article.sections || []).some((s) =>
      (s.contentBlocks || []).some(
        (b) => String(b.type || '').toLowerCase() === 'text' && hasChinese(b.content),
      ),
    );

  const tex = buildLatexDocument(article, {
    useChinese,
    bundleDir,
    bibFileName,
  });

  const texPath = path.join(bundleDir, `${safeTitle}.tex`);
  fs.writeFileSync(texPath, tex, 'utf-8');
  return texPath;
}

module.exports = { exportArticleLatex, escapeLatex, inlineToLatex, buildBibFile };
