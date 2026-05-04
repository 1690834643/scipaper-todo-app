import type { VocabPack } from '../sci-vocab'

export const bioinformaticsToolsPack: VocabPack = {
  id: 'bioinformatics-tools',
  name: '生信工具',
  description: '比对/组装/差异表达/单细胞/系统发生/基因组注释等生信流程工具与机器学习术语。',
  builtin: true,
  defaultEnabled: false,
  words: {
    general: [
      // Bioinformatics tools / pipelines (from sci-vocab general)
      'BLAST', 'BLASTN', 'BLASTP', 'BLASTX', 'MEGA', 'MAFFT', 'ClustalW',
      'Bowtie', 'Bowtie2', 'BWA', 'STAR', 'HISAT2', 'Salmon', 'Kallisto',
      'Trinity', 'Trimmomatic', 'FastQC', 'MultiQC', 'Cutadapt', 'samtools',
      'bcftools', 'bedtools', 'deepTools', 'IGV', 'GATK', 'HTSeq',
      'featureCounts', 'DESeq2', 'edgeR', 'limma', 'WGCNA',

      // Annotation / databases (specialized — common tools in pipelines)
      'FlyBase', 'WormBase', 'Pfam', 'InterPro', 'SMART', 'KEGG',
      'Gene Ontology', 'GO term', 'Reactome', 'STRING',
      'OrthoDB', 'OrthoFinder', 'PANTHER',

      // Machine learning / data science (used in bioinfo pipelines)
      'machine learning', 'deep learning', 'neural network', 'convolutional',
      'recurrent', 'LSTM', 'transformer', 'attention', 'embedding',
      'feature extraction', 'dimensionality reduction', 'PCA',
      'principal component analysis', 't-SNE', 'UMAP', 'k-means',
      'hierarchical clustering', 'random forest', 'decision tree',
      'support vector machine', 'SVM', 'cross-validation', 'confusion matrix',
      'precision', 'recall', 'F1 score', 'ROC curve', 'AUC', 'area under curve',
      'overfitting', 'underfitting', 'regularization', 'L1', 'L2',
      'dropout', 'batch normalization',

      // Sequencing data formats
      'FASTQ', 'BAM', 'VCF', 'WGS', 'UMI', 'variant-calling',
      'eDNA', 'metabarcoding', '16S', 'MaxEnt',
    ],
    methods: [
      // v6 methods bioinfo
      'pseudobulk', 'GSEA', 'cellranger',
      'seurat', 'scanpy', 'monocle3', 'macs2', 'diffbind',
      'fastp', 'stringtie',

      // v7 methods bioinfo
      'StringTie', 'peak-calling', 'MACS2', 'MEME', 'motif-enrichment',
      'gProfiler', 'cell-type',
      'splice-junction', 'isoform-level', 'maximum-likelihood', 'IQ-TREE', 'MrBayes',
      'dN-dS', 'codeml', 'PAML', 'chromosome-level', '3D-genome',
      'JBrowse', 'GFF3', 'GTF', 'RefSeq',

      // Claude v7 — sequencing assays not in mol-bio core
      'bulk-RNA-seq', 'total-RNA-seq', 'ribo-zero',
      'poly-A-selection', 'ribosome-profiling', 'ribo-seq', 'CAGE', 'GRO-seq', 'PRO-seq',
      'ONT',
      // Aligners / quantifiers
      'SOAPdenovo-Trans', 'kallisto', 'RSEM',
      // Differential expression / single cell
      'voom', 'NOIseq', 'BaySeq', 'sleuth', 'tximport',
      'MEGENA', 'iTALK', 'NicheNet', 'CellChat', 'scVI', 'scVelo', 'RNA-velocity',
      'Seurat', 'Scanpy', 'Monocle3', 'slingshot', 'harmony', 'scrublet', 'doubletfinder',
      // Dimensionality reduction
      'PHATE', 'MDS', 'NMF', 'ICA',
      // Enrichment
      'GO-enrichment', 'KEGG-enrichment', 'MSigDB', 'DAVID',
      'fgsea', 'ssGSEA', 'GSVA', 'AUCell', 'hypergeometric',
      // Phylogenetics / evolution
      'Bayesian-inference', 'RAxML', 'BEAST',
      'McDonald-Kreitman', 'Tajima-D', 'Fst', 'pi', 'theta',
      'phylogeny', 'phylogenomics', 'gene-tree', 'species-tree', 'divergence-time',
      // Variant / read tools
      'bwa', 'bwa-mem2', 'minimap2', 'mosdepth',
      'Strelka', 'freebayes', 'DeepVariant', 'VarScan', 'snpEff', 'snpSift',
      'Picard', 'MarkDuplicates',
      // Peak / motif tools
      'MACS3', 'HOMER', 'MEME-ChIP', 'FIMO', 'JASPAR',
      'bigwig', 'bedGraph', 'plotProfile', 'computeMatrix',
      // Genome annotation
      'RepeatMasker', 'RepeatModeler', 'EarlGrey', 'BUSCO', 'AUGUSTUS', 'MAKER', 'BRAKER',
      'Trinotate', 'eggNOG-mapper', 'InterProScan',
    ],
    results: [
      // v7 results — bioinfo-specific
      'AUROC', 'AUPRC',
      'training-set', 'test-set', 'validation-set',
      // Claude v7 — bioinfo results
      'quantile-normalized', 'batch-corrected', 'ComBat', 'RUVseq', 'harmony-corrected',
      'peak-summit', 'peak-width', 'FRiP', 'fragment-length', 'insert-size',
      'read-depth', 'breadth-of-coverage', 'even-coverage', 'uneven-coverage',
      'novel-isoform', 'retained-intron', 'exon-skipping', 'alt-3SS', 'alt-5SS',
      'ribo-occupancy', 'codon-bias', 'ENC', 'CAI', 'tAI', 'GC-content', 'repeat-content',
      'syntenic', 'in-paralog', 'out-paralog', 'RBH',
    ],
  },
  phrases: {},
}
