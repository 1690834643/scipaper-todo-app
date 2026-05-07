// =============================================================================
// htmlContent — TipTap-friendly storage helpers.
//
// block.content used to be plain text. As of v1.0.47 it stores HTML so the
// immersive editor can roundtrip headings, marks, and inline citation nodes.
// Old plain-text content is migrated lazily: the first read wraps it in
// <p>...</p>; the next save flushes the HTML form back to disk. Until then,
// downstream consumers must treat block.content as "HTML or plain text" and
// strip tags before counting words / matching text / building AI context.
// =============================================================================

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/

const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

export function looksLikeHtml(s: string): boolean {
  if (!s) return false
  return HTML_TAG_RE.test(s)
}

function decodeEntities(s: string): string {
  return s.replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, (m) => ENTITY_MAP[m] ?? m)
}

/** Returns plain text. Pass-through if input doesn't look like HTML. Block-level
 *  tags (p / h1..h6 / li / blockquote / br / div) become \n\n separators so
 *  word counters and AI prompts see paragraph boundaries. */
export function stripHtml(s: string): string {
  if (!s) return ''
  if (!looksLikeHtml(s)) return s
  const blockified = s
    .replace(/<\/?(?:p|div|h[1-6]|li|blockquote|ul|ol|figure|figcaption|tr|table|section|article)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>(?:\s*)/gi, '\n')
  const noTags = blockified.replace(/<[^>]+>/g, '')
  const decoded = decodeEntities(noTags)
  return decoded.replace(/\n{3,}/g, '\n\n').trim()
}

/** Convert plain text into the same HTML shape TipTap emits (one <p> per
 *  paragraph, <br> for soft breaks). Public so FocusModeEditor + other places
 *  share one source of truth. */
export function plainTextToHtml(text: string): string {
  if (!text) return ''
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Editor-load helper. Plain-text legacy content gets wrapped; HTML is fed in
 *  unchanged so existing marks / nodes survive a roundtrip. */
export function normalizeContentForEditor(content: string | null | undefined): string {
  const s = content ?? ''
  return looksLikeHtml(s) ? s : plainTextToHtml(s)
}
