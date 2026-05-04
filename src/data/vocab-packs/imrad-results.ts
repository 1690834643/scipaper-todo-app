import type { VocabPack } from '../sci-vocab'

export const imradResultsPack: VocabPack = {
  id: 'imrad-results',
  name: 'IMRaD · Results',
  description: '结果段落常用的差异表达、显著性、对照、剂量响应、图表类描述词。',
  builtin: true,
  defaultEnabled: true,
  words: {
    results: [
      // Original
      'upregulated', 'downregulated',
      'fold-change', 'log2 fold change', 'differentially expressed',
      'differentially expressed genes', 'DEGs', 'error bar', 'biological replicate',
      'technical replicate', 'wild-type', 'WT', 'mutant', 'transgenic line',
      'splice variant', 'ablation', 'complementation', 'rescue', 'epistasis',
      'suppressor', 'modifier', 'penetrance', 'expressivity', 'mosaic',
      'chimeric', 'hypomorphic', 'neomorphic', 'haploinsufficient', 'inducible',
      'conditional', 'constitutive', 'tissue-specific', 'stage-specific',
      'dose-dependent', 'time-dependent', 'synergistic', 'antagonistic',
      'additive', 'potentiated', 'attenuated', 'abolished', 'rescued',
      'restored', 'enhanced', 'suppressed', 'induced', 'repressed',
      'encapsulation', 'phagocytosis', 'nodulation',

      // v6 expansion (generic results vocabulary)
      'biphasic', 'monophasic', 'monotonic', 'asymptotic', 'hyperbolic',
      'sigmoidal', 'log-linear', 'plateau', 'ceiling', 'floor',
      'baseline', 'threshold', 'lag-phase', 'steady-state', 'all-or-none',
      'switch-like', 'pulsatile', 'oscillatory', 'magnitude', 'enrichment',
      'depletion', 'abundance', 'frequency', 'rate', 'fraction',
      'proportion', 'percentage', 'ratio', 'doubling-time', 'half-maximal',
      'dynamic-range', 'normalization', 'standardization', 'significantly',
      'nonsignificant', 'pronounced', 'marked', 'striking', 'dramatic',
      'modest', 'drastic', 'moderate', 'negligible', 'marginal',
      'colormap', 'heatmap', 'violin-plot', 'scatter-plot', 'density-plot',
      'volcano-plot', 'forest-plot', 'manhattan-plot', 'box-plot', 'q-q-plot',
      'ma-plot', 'decline', 'surge', 'stabilization', 'recovery',
      'persistence', 'fluctuation', 'peak', 'trough', 'nadir',
      'rebound', 'drift', 'remission',

      // Claude v7 additions (results-flavored)
      'differentially-expressed', 'DEG',
      'enriched', 'depleted', 'overrepresented', 'underrepresented',
      'co-expressed', 'co-regulated', 'co-activated', 'co-repressed', 'co-localized',
      'log-fold-change', 'fold-change', 'FC', 'log2-FC', 'log10-pvalue',
      'significant', 'marginally-significant', 'nonsignificant', 'n.s.', 'trending',
      'boxplot', 'swarmplot', 'beeswarm', 'ridgeplot',
      'fitted-curve', 'exponential-decay', 't-half',
    ],
  },
  phrases: {
    results: [
      { trigger: 'we next', text: 'We next examined' },
      { trigger: 'we further', text: 'We further investigated' },
      { trigger: 'we observed', text: 'We observed that' },
      { trigger: 'we found', text: 'We found that' },
      { trigger: 'compared with', text: 'Compared with the control' },
      { trigger: 'no significant', text: 'no significant difference' },
      { trigger: 'statistically significant', text: 'statistically significant' },
      { trigger: 'in a dose', text: 'in a dose-dependent manner' },
      { trigger: 'in a time', text: 'in a time-dependent manner' },
    ],
  },
}
