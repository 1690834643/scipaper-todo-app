import type { VocabPack } from '../sci-vocab'

export const coreAcademicPack: VocabPack = {
  id: 'core-academic',
  name: '学术写作核心',
  description: '连接词、副词、通用学术动词与高频学术词。任何学科都用得上的基础语汇。',
  builtin: true,
  defaultEnabled: true,
  words: {
    general: [
      // High-frequency academic connectors / adverbs
      'despite', 'however', 'although', 'nevertheless', 'furthermore', 'moreover',
      'whereas', 'nonetheless', 'consequently', 'additionally',
      'specifically', 'particularly', 'essentially', 'interestingly', 'importantly',
      'namely', 'whereby', 'hence', 'thus', 'previously', 'subsequently',
      'simultaneously', 'likewise', 'alternatively', 'similarly', 'accordingly',
      'meanwhile', 'thereafter', 'henceforth', 'because', 'whether', 'within',
      'without', 'between', 'among', 'across', 'beyond', 'towards', 'against',
      'including', 'excluding', 'regarding', 'concerning', 'following',
      'preceding', 'pertaining', 'comparable', 'consistent', 'congruent',

      // Curated "hard / often-misspelled" academic words
      'elucidate', 'ascertain', 'putative', 'concomitant', 'recapitulate',
      'robustly', 'albeit', 'underpin', 'corroborate', 'substantiate',
      'delineate', 'exacerbate', 'ameliorate', 'perturb', 'abrogate',
      'potentiate', 'modulate', 'orchestrate', 'converge', 'diverge',
      'redundantly', 'synergistically', 'spatiotemporal', 'ubiquitous',
      'stringent', 'versatile', 'unprecedented', 'underlying', 'compelling',
      'discrepancy', 'caveat', 'paradigm', 'framework', 'landscape',
      'repertoire', 'arsenal', 'plethora', 'myriad', 'notwithstanding',
      'conversely', 'presumably', 'arguably', 'collectively', 'cumulatively',
      'respectively', 'thereof', 'herein', 'thereby', 'notably', 'remarkably',
      'intriguingly', 'unexpectedly', 'consistently', 'predominantly',
      'partially', 'substantially', 'marginally', 'transiently', 'stably',
      'constitutively', 'inducibly', 'reversibly', 'irreversibly', 'dynamically',
      'quantitatively', 'qualitatively', 'functionally', 'structurally',
      'mechanistically', 'evolutionarily', 'phylogenetically', 'genomically',
      'transcriptionally', 'posttranscriptionally', 'translationally',
      'epigenetically', 'holistically', 'nominally', 'ostensibly', 'deleterious',
      'advantageous', 'detrimental', 'pathogenic', 'homeostatic', 'allosteric',
      'stochastic', 'pleiotropic', 'heritable', 'penetrant', 'promiscuous',
      'ectopic', 'dispensable', 'indispensable',

      // Claude v7 additions (generic academic flavor)
      'deciphering', 'recapitulating', 'inferring', 'illuminating', 'leveraging', 'harnessing',
      'implicating', 'imply', 'implies', 'exemplify', 'exemplifies', 'exemplified',
      'empirically', 'statistically', 'biologically', 'ecologically',
      'plausibly', 'conceivably',
      'canonical', 'noncanonical', 'prototypical', 'archetype',
      'recapitulation', 'dichotomy', 'trichotomy', 'taxonomy', 'ontology', 'lineage',
      'heterogeneity', 'redundancy', 'modularity',
      'plasticity', 'robustness', 'canalization', 'trade-off', 'fitness-cost',
    ],
  },
  phrases: {
    general: [
      { trigger: 'taken together', text: 'Taken together' },
      { trigger: 'consistent with', text: 'Consistent with' },
      { trigger: 'in agreement', text: 'In agreement with' },
      { trigger: 'in line with', text: 'In line with' },
      { trigger: 'in contrast', text: 'In contrast' },
      { trigger: 'to the best', text: 'To the best of our knowledge' },
      { trigger: 'with respect', text: 'with respect to' },
      { trigger: 'as opposed', text: 'as opposed to' },
    ],
  },
}
