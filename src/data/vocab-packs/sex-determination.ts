import type { VocabPack } from '../sci-vocab'

export const sexDeterminationPack: VocabPack = {
  id: 'sex-determination',
  name: '性别决定与发育',
  description: 'doublesex / DMRT / fruitless / transformer / Sxl 等性别决定与生殖发育术语。',
  builtin: true,
  defaultEnabled: false,
  words: {
    introduction: [
      // v7 introduction — sex determination
      'doublesex', 'dsx', 'DMRT', 'DMRT1', 'fruitless', 'fruM',
      'transformer', 'sex-biased', 'sex-specific', 'sex-limited',
      'dimorphic', 'monomorphic', 'germline',
      'meiosis', 'spermatogonia', 'spermatocyte', 'Sertoli',
      'pleiotropy', 'neofunctionalization', 'subfunctionalization',
      'cis-regulatory', 'palindromic', 'regulatory-evolution', 'motif',
      'evolutionary-conservation', 'evolutionary-constraint',
      'intersex', 'transformer-2', 'Sex-lethal',
      'aggression', 'dimorphic-behavior', 'mate-choice',
      'Lgr3', 'relaxin-receptor', 'Dilp8', 'Fmo-2',

      // Claude v7 introduction — sex-determination expansions
      'sex-determination', 'sex-determining', 'sex-linked',
      'sexually-dimorphic', 'sexually-selected', 'autosomal',
      'holokinetic', 'heteromorphic', 'homomorphic', 'ZW', 'WZ', 'XY', 'XO',
      'DsxM', 'DsxF', 'DMRT3', 'DMRT5', 'DMRT93B',
      'fem', 'Sxl',
      'spermatheca', 'accessory-gland', 'ovariole', 'follicle', 'testis', 'ovary',
      'hermaphrodite', 'gonochoric', 'parthenogenetic',
      'paralogous-divergence',
    ],
  },
  phrases: {},
}
