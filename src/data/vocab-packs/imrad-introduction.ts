import type { VocabPack } from '../sci-vocab'

export const imradIntroductionPack: VocabPack = {
  id: 'imrad-introduction',
  name: 'IMRaD · Introduction',
  description: '前言段落常用的假设、引述、研究空白、研究意义类词汇与短语。',
  builtin: true,
  defaultEnabled: true,
  words: {
    introduction: [
      // Original
      'hypothesize', 'postulate', 'premise', 'posit', 'underscore',
      'acknowledge', 'comprehend', 'hitherto', 'heretofore', 'recently',
      'currently', 'emerging', 'burgeoning', 'accumulating', 'mounting',
      'seminal', 'landmark', 'pioneering', 'groundbreaking', 'cornerstone',
      'rationale', 'impetus', 'incentive', 'motivation', 'objective',
      'endeavor', 'undertaking', 'pursuit', 'unresolved', 'unexplored',
      'uncharacterized', 'unidentified', 'undetermined', 'enigmatic', 'elusive',
      'inconclusive', 'equivocal', 'controversial',

      // v6 expansion (generic introduction vocabulary)
      'prevailing', 'longstanding', 'pervasive', 'widespread', 'overarching',
      'systemic', 'integrative', 'interdisciplinary', 'cross-disciplinary', 'multidisciplinary',
      'frontier', 'well-established', 'encompass', 'milestone', 'hallmark',
      'archetypal', 'emblematic', 'foundational', 'fundamental', 'pivotal',
      'crucial', 'intrinsic', 'innate', 'inherent', 'salience',
      'prominence', 'significance', 'importance', 'relevance', 'multifaceted',
      'multifactorial', 'intricate', 'convoluted', 'nuanced', 'subtle',
      'interplay', 'crosstalk', 'hierarchy', 'ramification', 'progression',
      'evolution', 'adaptation', 'advancement', 'trend', 'tendency',
      'prevalence', 'incidence', 'realm', 'domain', 'gap',
      'knowledge-gap', 'shortcoming', 'paucity', 'dearth', 'scarcity',
      'absence', 'insufficiency', 'inadequacy', 'uncertainty', 'ambiguity',
      'obscurity', 'contentious', 'debatable', 'disputable', 'questionable',
      'doubtful', 'skeptical', 'dubious', 'speculative', 'tentative',
      'provisional', 'nascent', 'incipient', 'fledgling', 'embryonic',
      'rudimentary', 'primitive', 'comprehensive', 'systematic', 'rigorous',
      'extensive', 'empirical', 'experimental', 'theoretical', 'computational',
      'scenario', 'legacy', 'heritage', 'configuration', 'heterogeneity',
      'homogeneity', 'analogy', 'parallel', 'divergence', 'spectrum',
      'continuum', 'modeling',
    ],
  },
  phrases: {
    introduction: [
      { trigger: 'to date', text: 'To date' },
      { trigger: 'remains poorly', text: 'remains poorly understood' },
      { trigger: 'remains to be', text: 'remains to be elucidated' },
      { trigger: 'little is known', text: 'Little is known about' },
      { trigger: 'we hypothesized', text: 'We hypothesized that' },
      { trigger: 'plays a critical', text: 'plays a critical role in' },
      { trigger: 'plays a pivotal', text: 'plays a pivotal role in' },
      { trigger: 'has been implicated', text: 'has been implicated in' },
      { trigger: 'in this study', text: 'In this study, we' },
    ],
  },
}
