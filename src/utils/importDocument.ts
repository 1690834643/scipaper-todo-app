import type { SectionType } from '../types'

export type ManuscriptImportStrategy = 'section' | 'heading' | 'single'

export interface ImportSourceFile {
  filePath: string
  fileName: string
  text: string
}

export interface ImportDocumentBlock {
  id: string
  sectionType: SectionType
  title: string
  content: string
  sourceName: string
  sourceBlockId?: string
}

export interface ParseMarkdownImportOptions {
  strategy: ManuscriptImportStrategy
  targetSection?: SectionType
  sourceName?: string
}

export function joinImportSourceNames(files: Array<Pick<ImportSourceFile, 'fileName'>>): string {
  return files.map((file) => file.fileName).filter(Boolean).join(', ')
}
