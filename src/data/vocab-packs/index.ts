import type { VocabPack } from '../sci-vocab'
import { coreAcademicPack } from './core-academic'
import { molecularBiologyPack } from './molecular-biology'
import { imradIntroductionPack } from './imrad-introduction'
import { imradMethodsPack } from './imrad-methods'
import { imradResultsPack } from './imrad-results'
import { imradDiscussionPack } from './imrad-discussion'
import { bioinformaticsToolsPack } from './bioinformatics-tools'
import { statisticsMethodsPack } from './statistics-methods'
import { lepidopteraInsectPack } from './lepidoptera-insect'
import { sexDeterminationPack } from './sex-determination'
import { epigeneticsRnaPack } from './epigenetics-rna'

/**
 * Display order for built-in packs in Settings UI.
 * Default-enabled packs first (core/IMRaD), then specialized opt-in packs.
 */
export const BUILTIN_PACKS: VocabPack[] = [
  coreAcademicPack,
  molecularBiologyPack,
  imradIntroductionPack,
  imradMethodsPack,
  imradResultsPack,
  imradDiscussionPack,
  bioinformaticsToolsPack,
  statisticsMethodsPack,
  lepidopteraInsectPack,
  sexDeterminationPack,
  epigeneticsRnaPack,
]
