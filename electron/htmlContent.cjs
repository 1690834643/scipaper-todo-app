// Shared HTML helpers for the electron-side code. Mirrors src/utils/htmlContent.ts —
// keep the two in sync so renderer save / main process consumers see the same
// shape after stripping. block.content has been HTML since v1.0.47; legacy
// plain-text rows pass through untouched.

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/;

function looksLikeHtml(s) {
  if (!s) return false;
  return HTML_TAG_RE.test(s);
}

function stripHtml(text) {
  if (typeof text !== 'string' || !text) return '';
  if (!HTML_TAG_RE.test(text)) return text;
  const blockified = text
    .replace(/<\/?(?:p|div|h[1-6]|li|blockquote|ul|ol|figure|figcaption|tr|table|section|article)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>(?:\s*)/gi, '\n');
  return blockified
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { looksLikeHtml, stripHtml };
