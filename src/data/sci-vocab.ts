/**
 * SciPaper Todo - Academic vocabulary autocomplete library
 *
 * Words and phrases are organised into pluggable **vocab packs** under
 * src/data/vocab-packs/. The legacy SCI_WORDS / SCI_PHRASES exports below
 * aggregate every built-in pack so existing call sites keep working until
 * the renderer migrates to mergeEnabledPacks(packs, prefs, customVocab).
 *
 * Pack design rules (2026-05-04):
 *   - Default-on packs cover only generic academic + universal mol-bio + IMRaD
 *     framing. Specialized vocabulary (bioinformatics tools, statistics,
 *     lepidoptera, sex determination, epigenetics) ships disabled — users
 *     opt in per-domain or import their own packs.
 *   - Words >> phrases. Phrases stay short (<= 7 words) and have no
 *     ${...} placeholders.
 *
 * To add a built-in pack: create src/data/vocab-packs/<id>.ts and append it
 * to BUILTIN_PACKS in src/data/vocab-packs/index.ts.
 */

export type SciSection = 'general' | 'introduction' | 'methods' | 'results' | 'discussion'

export interface SciPhrase {
  /** Trigger prefix the user types — case-insensitive prefix match. */
  trigger: string
  /** Full phrase to insert. Keep short and self-contained. */
  text: string
  /** Optional one-line label shown in the dropdown. */
  label?: string
}

export interface VocabPack {
  /** Stable id used as the key in storage prefs and import/export payloads. */
  id: string
  /** Human-readable name shown in Settings. */
  name: string
  /** One-line description shown next to the toggle in Settings. */
  description: string
  /** True for shipped packs; false for user-imported packs. */
  builtin: boolean
  /** Initial state when the user has no preference saved yet. */
  defaultEnabled: boolean
  /** Words contributed per IMRaD section. Sections may be omitted. */
  words: Partial<Record<SciSection, string[]>>
  /** Phrases contributed per IMRaD section. Sections may be omitted. */
  phrases: Partial<Record<SciSection, SciPhrase[]>>
}

import { BUILTIN_PACKS } from './vocab-packs'

const SECTIONS: SciSection[] = ['general', 'introduction', 'methods', 'results', 'discussion']

/**
 * Merge any selection of packs into the {section: string[]} shape that
 * AutocompleteExtension expects. Case-insensitive de-duplication keeps the
 * first occurrence so pack order in BUILTIN_PACKS controls precedence.
 */
export function aggregatePackWords(packs: VocabPack[]): Record<SciSection, string[]> {
  const out: Record<SciSection, string[]> = {
    general: [], introduction: [], methods: [], results: [], discussion: [],
  }
  const seen: Record<SciSection, Set<string>> = {
    general: new Set(), introduction: new Set(), methods: new Set(),
    results: new Set(), discussion: new Set(),
  }
  for (const pack of packs) {
    for (const section of SECTIONS) {
      const words = pack.words[section]
      if (!words) continue
      for (const w of words) {
        const key = w.toLowerCase()
        if (seen[section].has(key)) continue
        seen[section].add(key)
        out[section].push(w)
      }
    }
  }
  return out
}

/**
 * Merge any selection of packs' phrase lists into {section: SciPhrase[]}.
 * De-duped on `trigger` (case-insensitive) so two packs declaring the same
 * trigger keep the first one.
 */
export function aggregatePackPhrases(packs: VocabPack[]): Record<SciSection, SciPhrase[]> {
  const out: Record<SciSection, SciPhrase[]> = {
    general: [], introduction: [], methods: [], results: [], discussion: [],
  }
  const seen: Record<SciSection, Set<string>> = {
    general: new Set(), introduction: new Set(), methods: new Set(),
    results: new Set(), discussion: new Set(),
  }
  for (const pack of packs) {
    for (const section of SECTIONS) {
      const phrases = pack.phrases[section]
      if (!phrases) continue
      for (const p of phrases) {
        const key = p.trigger.toLowerCase()
        if (seen[section].has(key)) continue
        seen[section].add(key)
        out[section].push(p)
      }
    }
  }
  return out
}

/** Built-in pack registry, re-exported for convenience. */
export { BUILTIN_PACKS } from './vocab-packs'

/**
 * Legacy aggregated view. Includes every built-in pack regardless of
 * defaultEnabled — callers that want the per-user filtered view should
 * use aggregatePackWords / aggregatePackPhrases with the live pack set.
 */
export const SCI_WORDS: Record<SciSection, string[]> = aggregatePackWords(BUILTIN_PACKS)
export const SCI_PHRASES: Record<SciSection, SciPhrase[]> = aggregatePackPhrases(BUILTIN_PACKS)
