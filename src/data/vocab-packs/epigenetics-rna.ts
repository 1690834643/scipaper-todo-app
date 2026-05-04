import type { VocabPack } from '../sci-vocab'

export const epigeneticsRnaPack: VocabPack = {
  id: 'epigenetics-rna',
  name: '表观遗传与 RNA',
  description: 'piRNA / m6A / lncRNA / circRNA / methylation / Argonaute / Piwi / ChIP-seq / ATAC-seq 等表观与 RNA 调控术语。',
  builtin: true,
  defaultEnabled: false,
  words: {
    general: [
      // RNA species / regulators (specialized)
      'lncRNA', 'piRNA', 'circRNA',
      'Dicer', 'Argonaute', 'RISC',

      // Chromatin / epigenetic modifications
      'methylation', 'acetylation',

      // Epigenomic assays (general bucket)
      'ATAC-seq', 'ChIP-seq', 'CUT&RUN', 'CUT&Tag', 'Hi-C',
      'MeDIP-seq', 'BS-seq', 'bisulfite sequencing',
    ],
    methods: [
      // v7 methods — epigenetics / RNA regulation
      'bisulfite', 'CpG-island', 'm6A', 'MeRIP-seq', 'm6A-seq',
      'piRNA-biogenesis', 'Aubergine', 'Piwi',
      'TE', 'LINE', 'SINE', 'LTR-retrotransposon', 'Gypsy', 'Copia',

      // Claude v7 methods — chromatin / RNA regulation
      'CUT-and-RUN', 'CUT-and-Tag', 'MNase-seq', 'DNase-seq',
      'HiC', 'micro-C', 'capture-Hi-C', 'eccDNA', 'ChIA-PET',
      'miCLIP', 'bisulfite-seq', 'EM-seq',
      'DamID', 'TaDa', 'CLIP-seq', 'eCLIP', 'iCLIP', 'RIP-seq',

      // piRNA-specific tools
      'piRNAdb', 'piPipes', 'ProTRAC', 'piRDeep2', 'ShortStack', 'sRNAbench',
    ],
  },
  phrases: {},
}
