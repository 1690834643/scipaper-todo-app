// =============================================================================
// CitationExtension — TipTap inline-atom node for `[Wilson 1994]` style cites.
//
// Why a node, not a mark: a citation is one indivisible unit. Cursor doesn't
// step through letters, backspace deletes the whole pill, and the displayed
// label can drift from the real key (renaming "Wilson 1994" → "Wilson 1994a"
// without re-typing). Marks would need text inside them; nodes own their
// rendering.
//
// Storage: <span class="wp-cite" data-cite-key="..." contenteditable="false">
//          [Wilson 1994]
//          </span>
// HTML roundtrips losslessly through getHTML() / setContent().
//
// Visual styling lives on .wp-cite in focus-mode.css (accent-soft pill in
// claude/fresh, hard inverse block in pixel theme).
// =============================================================================

import { Node, mergeAttributes } from '@tiptap/core'

export interface CitationOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (attrs: { citeKey: string; displayText: string }) => ReturnType
    }
  }
}

export const Citation = Node.create<CitationOptions>({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      citeKey: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-cite-key') ?? '',
        renderHTML: (attrs) => ({ 'data-cite-key': String(attrs.citeKey ?? '') }),
      },
      displayText: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).textContent ?? '',
        // textContent is rendered via the inner [text] in renderHTML, not
        // emitted as an attribute, so this is a no-op.
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-cite-key]',
        getAttrs: (el) => {
          const node = el as HTMLElement
          return {
            citeKey: node.getAttribute('data-cite-key') ?? '',
            displayText: node.textContent ?? '',
          }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const display = String(node.attrs.displayText ?? '').trim() || `[${node.attrs.citeKey}]`
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'wp-cite',
        contenteditable: 'false',
        'data-cite-key': String(node.attrs.citeKey ?? ''),
      }),
      display,
    ]
  },

  renderText({ node }) {
    // Plain-text fallback (used by stripHtml at storage edges and by
    // `editor.getText()` if anything still calls it). Keeps the bracketed
    // label so AI / word-count consumers see something readable.
    const display = String(node.attrs.displayText ?? '').trim()
    return display || `[${node.attrs.citeKey}]`
  },

  addCommands() {
    return {
      insertCitation:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                citeKey: attrs.citeKey,
                displayText: attrs.displayText,
              },
            })
            .insertContent(' ')
            .run(),
    }
  },
})
