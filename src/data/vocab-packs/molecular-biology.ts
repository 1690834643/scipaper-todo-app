import type { VocabPack } from '../sci-vocab'

export const molecularBiologyPack: VocabPack = {
  id: 'molecular-biology',
  name: '分子生物学（通用）',
  description: 'RNA/DNA、CRISPR、PCR、克隆载体、转录组、细胞与信号通路、免疫、病毒、生化、纳米与方法学等通用术语。',
  builtin: true,
  defaultEnabled: true,
  words: {
    general: [
      // Core molecular biology
      'RNAi', 'RNA interference', 'siRNA', 'miRNA',
      'dsRNA', 'ssRNA', 'mRNA', 'tRNA', 'rRNA', 'snRNA', 'snoRNA', 'sgRNA',
      'gRNA', 'crRNA', 'tracrRNA', 'antisense', 'oligonucleotide', 'ribozyme',
      'transcriptome', 'genome', 'proteome',
      'metabolome', 'epigenome', 'methylome', 'microbiome', 'exome',
      'transcript', 'transcription', 'translation', 'transcription factor',
      'promoter', 'enhancer', 'silencer', 'terminator', 'cis-element',
      'trans-element', 'polyadenylation', 'polyA tail', '5\'UTR', '3\'UTR',
      'ORF', 'open reading frame', 'codon', 'start codon', 'stop codon',
      'frameshift', 'missense', 'nonsense', 'synonymous', 'nonsynonymous',
      'indel', 'SNP', 'SNV', 'CNV', 'structural variant',
      'allele', 'locus', 'haplotype', 'genotype', 'phenotype', 'recessive',
      'dominant', 'codominant', 'heterozygous', 'homozygous', 'hemizygous',
      'haploid', 'diploid', 'polyploid', 'aneuploid', 'chromosome', 'karyotype',
      'autosome', 'telomere', 'centromere', 'heterochromatin', 'euchromatin',
      'nucleosome', 'histone', 'chromatin',
      'phosphorylation', 'ubiquitination', 'sumoylation', 'glycosylation',
      'prenylation', 'palmitoylation', 'post-translational modification', 'PTM',
      'intron', 'exon', 'splice site', 'splicing', 'alternative splicing',
      'isoform', 'paralog', 'ortholog', 'homolog', 'paralogous', 'orthologous',
      'conserved', 'divergent', 'duplication', 'pseudogene',
      'extracellular', 'intracellular', 'periplasmic', 'membranous', 'transmembrane',
      'gain-of-function', 'loss-of-function', 'null-allele',

      // CRISPR / gene editing
      'CRISPR', 'CRISPR/Cas9', 'Cas9', 'Cas12a', 'Cas13', 'PAM',
      'base editing', 'prime editing', 'knockout', 'knockin', 'knockdown',
      'conditional knockout', 'Cre/loxP', 'CRISPRi', 'CRISPRa', 'CRISPR screen',
      'double-strand break', 'DSB', 'NHEJ', 'HDR', 'homology-directed repair',
      'overexpression', 'silencing', 'rescue experiment', 'genetic complementation',

      // Cloning / vectors / reporters
      'plasmid', 'vector', 'expression vector', 'viral vector', 'lentivirus',
      'AAV', 'adenovirus', 'retrovirus', 'baculovirus', 'transfection',
      'transduction', 'electroporation', 'microinjection', 'transgenic',
      'transgene', 'GFP', 'EGFP', 'mCherry', 'mScarlet', 'luciferase',
      'FLAG-tag', 'His-tag', 'HA-tag', 'Myc-tag', 'V5-tag', 'fusion protein',
      'reporter gene', 'inducible promoter', 'tetracycline', 'doxycycline',

      // PCR family
      'PCR', 'qPCR', 'RT-PCR', 'RT-qPCR', 'semi-quantitative PCR',
      'nested PCR', 'multiplex PCR', 'ddPCR', 'droplet digital PCR',
      'forward primer', 'reverse primer', 'amplicon', 'melting curve',
      'Cq value', 'Ct value', 'threshold cycle', 'housekeeping gene',
      'internal control', 'reference gene', 'no-template control', 'NTC',

      // Sequencing / omics technologies (broad use)
      'RNA-seq', 'mRNA-seq', 'smRNA-seq', 'small RNA-seq', 'scRNA-seq',
      'single-cell RNA-seq', 'snRNA-seq',
      'whole-genome sequencing', 'whole-exome sequencing', 'long-read sequencing',
      'short-read sequencing', 'Nanopore', 'PacBio', 'Illumina', 'NovaSeq',
      'NextSeq', 'MiSeq', 'HiSeq', 'paired-end', 'single-end', 'read depth',
      'sequencing depth', 'coverage', 'mapping rate', 'unique mapping',

      // Common databases / annotation references
      'GenBank', 'UniProt', 'NCBI', 'Ensembl',

      // Cell biology / organelles
      'mitochondria', 'mitochondrion', 'endoplasmic reticulum', 'ER stress',
      'Golgi apparatus', 'lysosome', 'peroxisome', 'cytoskeleton', 'microtubule',
      'actin filament', 'cilia', 'flagella', 'cytoplasm', 'nucleus',
      'nucleolus', 'nuclear envelope', 'plasma membrane', 'membrane potential',
      'organelle', 'vesicle', 'endocytosis', 'exocytosis', 'autophagy',
      'autophagosome', 'mitophagy', 'lipophagy', 'apoptosis', 'necrosis',
      'necroptosis', 'ferroptosis', 'pyroptosis', 'unfolded protein response',
      'UPR', 'reactive oxygen species', 'ROS', 'oxidative stress',

      // Protein chemistry
      'kinase', 'phosphatase', 'ubiquitin', 'deubiquitination', 'SUMO',
      'proteasome', 'chaperone', 'heat shock protein', 'HSP70', 'HSP90',
      'peptide', 'conformation', 'conformational change', 'allostery',
      'binding affinity', 'dissociation constant', 'Kd', 'IC50', 'EC50',

      // Signaling pathways
      'signaling pathway', 'signal transduction', 'MAPK', 'JNK', 'p38', 'ERK',
      'PI3K', 'AKT', 'mTOR', 'Wnt', 'Hedgehog', 'Notch', 'JAK-STAT', 'JAK/STAT',
      'NF-κB', 'NF-kB', 'TGF-β', 'TGF-beta', 'BMP', 'Hippo', 'YAP', 'TAZ',
      'IMD pathway', 'Toll pathway', 'Imd',

      // Immunology
      'cytokine', 'chemokine', 'antibody', 'antigen', 'MHC class I', 'MHC class II',
      'T cell', 'B cell', 'NK cell', 'dendritic cell', 'macrophage',
      'neutrophil', 'eosinophil', 'basophil', 'monocyte', 'lymphocyte',
      'regulatory T cell', 'Treg', 'helper T cell', 'Th1', 'Th2', 'Th17',
      'IgG', 'IgM', 'IgA', 'IgE', 'IgD',
      'complement', 'opsonization', 'phagosome', 'antigen presentation',
      'costimulation', 'immune checkpoint',
      'PD-1', 'PD-L1', 'CTLA-4', 'TCR', 'BCR', 'V(D)J recombination',
      'isotype switching', 'immunoglobulin', 'interferon',
      'IFN-α', 'IFN-β', 'IFN-γ', 'interleukin',
      'IL-1', 'IL-2', 'IL-6', 'IL-10', 'TNF-α', 'granzyme', 'perforin',
      'autoimmunity', 'tolerance', 'allergy', 'hypersensitivity',
      'vaccination', 'adjuvant', 'immunogenicity', 'epitope', 'neoepitope',
      'MALT', 'GALT', 'thymus', 'spleen', 'lymph node', 'germinal center',

      // Virology / Microbiology
      'virion', 'capsid', 'envelope', 'glycoprotein',
      'hemagglutinin', 'neuraminidase', 'spike protein', 'RBD', 'ACE2 receptor',
      'viral load', 'titer', 'plaque assay', 'MOI', 'multiplicity of infection',
      'viral replication', 'latency', 'lytic cycle', 'integration', 'provirus',
      'reverse transcriptase', 'reverse transcription', 'RNase H',
      'capsid assembly', 'budding', 'prion', 'biofilm', 'quorum sensing',
      'plasmid conjugation', 'transformation',
      'gram-positive', 'gram-negative', 'anaerobic', 'aerobic',
      'facultative', 'obligate', 'opportunistic pathogen', 'virulence factor',
      'toxin', 'endotoxin', 'exotoxin', 'lipopolysaccharide', 'LPS',
      'peptidoglycan', 'sporulation', 'antimicrobial resistance',
      'MIC', 'minimum inhibitory concentration', 'MBC', 'biocide',

      // Chemistry / Biochemistry
      'hydrolysis', 'oxidation', 'reduction', 'redox',
      'electrophile', 'nucleophile', 'catalyst', 'catalysis', 'enzymatic',
      'substrate specificity', 'cofactor', 'coenzyme',
      'NAD+', 'NADH', 'NADP+', 'NADPH', 'FAD', 'FADH2',
      'ATP', 'ADP', 'AMP', 'cAMP', 'cGMP', 'GTP', 'GDP',
      'pyrophosphate', 'phosphodiester', 'ester bond', 'amide bond',
      'peptide bond', 'disulfide bond', 'hydrogen bond', 'van der Waals',
      'hydrophobic interaction', 'ionic strength', 'pH gradient',
      'buffer', 'isoelectric point', 'pI', 'pKa', 'equilibrium constant',
      'Michaelis-Menten', 'Km', 'Vmax', 'kcat',
      'allosteric inhibition', 'competitive inhibition', 'noncompetitive inhibition',
      'transition state', 'activation energy', 'free energy',
      'Gibbs free energy', 'enthalpy', 'entropy', 'exothermic', 'endothermic',
      'thermodynamics', 'kinetics',

      // Materials science / Nanotech (frequently used in bio applications)
      'nanoparticle', 'nanowire', 'nanotube', 'nanocrystal', 'quantum dot',
      'liposome', 'micelle', 'nanocomposite', 'polymer', 'copolymer', 'monomer',
      'hydrogel', 'scaffold', 'matrix', 'biomaterial', 'biocompatible',
      'bioresorbable', 'surface functionalization', 'surface modification',
      'self-assembly', 'nanostructure', 'mesoporous', 'nanofiber', 'dendrimer',
      'gold nanoparticle', 'AuNP', 'silver nanoparticle', 'AgNP',
      'iron oxide nanoparticle', 'drug delivery', 'controlled release',
      'sustained release', 'encapsulation efficiency', 'loading efficiency',
      'surface plasmon resonance', 'SPR', 'zeta potential',
      'dynamic light scattering', 'DLS',
      'transmission electron microscopy', 'TEM',
      'scanning electron microscopy', 'SEM',
      'atomic force microscopy', 'AFM',
      'X-ray diffraction', 'XRD', 'FTIR', 'Raman spectroscopy',

      // General methodology / terminology
      'assay', 'calibration', 'validation', 'optimization', 'characterization',
      'quantification', 'qualification', 'standard curve', 'dose-response',
      'concentration-response', 'time-course', 'IC90', 'EC90', 'LD50',
      'half-life', 'bioavailability', 'pharmacokinetics', 'pharmacodynamics',
      'in vivo', 'in vitro', 'ex vivo', 'in situ', 'ex situ',
      'biosensor', 'biomarker', 'screening', 'high-throughput screening', 'HTS',
      'library screening', 'drug discovery', 'lead compound',
      'off-target', 'on-target', 'mechanism of action', 'MoA',
      'structure-activity relationship', 'SAR', 'scaffolding', 'fragment-based',
    ],
  },
  phrases: {},
}
