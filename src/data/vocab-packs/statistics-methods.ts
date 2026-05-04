import type { VocabPack } from '../sci-vocab'

export const statisticsMethodsPack: VocabPack = {
  id: 'statistics-methods',
  name: '统计方法',
  description: '检验、回归、多重比较、贝叶斯、效应量、模型评估等统计与定量分析术语。',
  builtin: true,
  defaultEnabled: false,
  words: {
    general: [
      // Statistics (from sci-vocab general)
      'ANOVA', 'one-way ANOVA', 'two-way ANOVA', 't-test', 'Student\'s t-test',
      'paired t-test', 'Welch\'s t-test', 'Mann-Whitney', 'Wilcoxon',
      'Kruskal-Wallis', 'Chi-square', 'Fisher\'s exact test', 'FDR',
      'Bonferroni', 'Holm-Sidak', 'Tukey', 'Dunnett', 'Spearman', 'Pearson',
      'linear regression', 'logistic regression', 'GLM', 'mixed-effects model',
      'standard deviation', 'standard error', 'SD', 'SEM', 'P-value',

      // Math / Statistics (general bucket)
      'variance', 'covariance', 'eigenvalue', 'eigenvector', 'scalar',
      'gradient', 'derivative', 'integral', 'differential equation',
      'deterministic', 'Monte Carlo', 'Markov chain',
      'Bayesian', 'prior', 'posterior', 'likelihood', 'maximum likelihood',
      'MLE', 'MAP',

      // Claude v7 generic stats
      'correlation', 'regression', 'residual', 'intercept', 'slope',
    ],
    methods: [
      // v6 methods stats
      'Benjamini-Hochberg', 'false-discovery-rate', 'Kaplan-Meier',
      'Cox-regression', 'ridge', 'lasso', 'elastic-net', 'random-forest',
      'xgboost', 'DBSCAN', 'hierarchical-clustering', 'GLMM',
      'propensity-score', 'intent-to-treat', 'cohort',
      'case-control', 'cross-sectional', 'double-blind', 'covariate', 'confounder',
      'sensitivity-analysis', 'survival-analysis', 'batch-correct',

      // v7 methods stats
      'dose-mortality', 'Probit', 'logit', 'Abbott', 'SPSS',
    ],
    results: [
      // v7 results expansion (almost all stats vocabulary)
      'upregulation', 'downregulation', 'log2FC', 'FDR',
      'q-value', 'p-adjusted', 'adjusted-p', 'nominal-p', 'raw-p',
      'Holm', 'Storey', 'BH-FDR', 'permutation', 'permutation-test',
      'empirical-p', 'randomization-test', 'bootstrap', 'jackknife', 'cross-validation',
      'k-fold', 'leave-one-out', 'LOOCV', 'stratified', 'holdout',
      'precision-recall', 'specificity', 'true-positive', 'false-positive', 'true-negative',
      'false-negative', 'TPR', 'FPR', 'TNR', 'FNR',
      'PPV', 'NPV', 'balanced-accuracy', 'MCC', 'cohen-kappa',
      'concordance', 'c-index', 'Harrell-c', 'Brier-score', 'log-loss',
      'marginal-R2', 'conditional-R2', 'Nakagawa-R2', 'ICC', 'intra-class',
      'repeatability', 'agreement', 'Lin-CCC', 'Bland-Altman', 'limits-of-agreement',
      'QQ-plot', 'PP-plot', 'residual-plot', 'fitted-vs-observed', 'observed-vs-predicted',
      'calibration', 'goodness-of-fit', 'Shapiro-Wilk', 'Kolmogorov-Smirnov', 'Anderson-Darling',
      'Lilliefors', 'Jarque-Bera', 'skewness', 'kurtosis', 'Levene',
      'Bartlett', 'Fligner-Killeen', 'Brown-Forsythe', 'homoscedasticity', 'heteroscedasticity',

      // v6 results extras (stats-flavored sub-set moved here)
      'confidence-interval', 'prediction-interval', 'degrees-of-freedom', 't-statistic', 'f-statistic',
      'r-squared', 'rmse', 'mae', 'effect-size', 'cohen-d',
      'hedges-g', 'odds-ratio', 'hazard-ratio', 'relative-risk',
      'z-score',

      // Claude v7 — stats results
      'Kendall', 'partial-correlation', 'autocorrelation',
      'ANCOVA', 'MANOVA', 'mixed-model', 'LME4',
      'chi-squared', 'Fisher-exact',
      'post-hoc', 'Bonferroni-correction', 'Sidak',
    ],
  },
  phrases: {},
}
