import type { VocabPack } from '../sci-vocab'

export const lepidopteraInsectPack: VocabPack = {
  id: 'lepidoptera-insect',
  name: '鳞翅目昆虫学',
  description: 'Chilo / Bombyx / Spodoptera 等模式昆虫与发育、内分泌、抗性、化学感受相关词汇。',
  builtin: true,
  defaultEnabled: false,
  words: {
    general: [
      // Insect / Lepidoptera specific (sci-vocab general)
      'larva', 'larval', 'instar', 'pupa', 'pupal', 'prepupa', 'prepupal',
      'imago', 'eclosion', 'ecdysis', 'molting', 'metamorphosis', 'hemolymph',
      'fat body', 'midgut', 'foregut', 'hindgut', 'malpighian tubule',
      'juvenile hormone', 'JH', 'ecdysone', 'ecdysteroid', '20E',
      '20-hydroxyecdysone', 'vitellogenin', 'hexamerin', 'chorion', 'oocyte',
      'oogenesis', 'spermatogenesis', 'embryogenesis', 'cuticle', 'chitin',
      'chitinase', 'chitin synthase', 'melanization', 'phenoloxidase',
      'antimicrobial peptide', 'AMP', 'defensin', 'cecropin', 'attacin',
      'gloverin', 'lebocin', 'moricin', 'diapause', 'voltinism', 'polyphagous',
      'oligophagous', 'monophagous', 'host plant', 'oviposition', 'fecundity',
      'Chilo suppressalis', 'Bombyx mori', 'Spodoptera', 'Helicoverpa',
      'Plutella xylostella', 'Drosophila',

      // Pesticide / pest biology (sci-vocab general)
      'insecticide', 'pesticide', 'resistance', 'susceptibility',
      'cross-resistance', 'detoxification', 'cytochrome P450', 'CYP', 'P450',
      'glutathione S-transferase', 'GST', 'esterase', 'metabolic resistance',
      'target-site mutation', 'biopesticide',
    ],
    introduction: [
      // v7 introduction — lepidoptera & insect biology
      'Chilo', 'suppressalis', 'Crambidae', 'lepidopteran', 'lepidopterans',
      'chemoreception', 'pheromone', 'ovipositor', 'courtship', 'mating',
      'antennal', 'chemosensory', 'gustatory', 'olfactory', 'odorant',
      'sensillum', 'sensilla', 'proboscis', 'labellum', 'tarsus',
      'maxillary', 'palp', 'chemoreceptor', 'pheromone-binding',
      'juvenile-hormone', 'overwintering',
      'pupation', 'methoprene-tolerant', 'JH-signaling', 'vitellogenin-receptor',
      'GH18', 'larval-moult',

      // Claude v7 introduction — lepidoptera-specific additions
      'holometabola', 'hemimetabola', 'exopterygote', 'endopterygote', 'panoistic', 'meroistic',
      'Pyralidae', 'Noctuidae', 'Tortricidae', 'Pieridae', 'Nymphalidae',
      'pheromone-gland', 'scolopidia', 'antennal-lobe',
      'courtship-behavior', 'mating-success', 'sperm-competition', 'polyandry', 'monandry',
      'sex-pheromone', 'host-plant', 'larval-host', 'univoltine', 'bivoltine',
      'post-diapause', 'supercooling', 'cold-tolerance',
      'ecdysteroid', 'ecdysone-receptor', 'EcR', 'USP', 'Kr-h1', 'Br-C', 'E93',
    ],
    methods: [
      // v7 methods — lepidoptera & insect-specific assays
      'Malpighian-tubule', 'prothoracic-gland', 'corpora-allata',
      'Cry1Ab', 'Cry1Ac', 'Cry2A',
      'host-associated', 'parasitic-stress', 'polydnavirus', 'overwintering-larva',
      'COI', 'mtDNA',
      'cross-resistance', 'target-site', 'biopesticide', 'detoxification',
      'metabolic-resistance', 'glutathione-S-transferase',
      'resistance-ratio', 'LC50', 'LT50', 'relative-fitness', 'selection-pressure',
      'phenotype-scoring', 'behavioral-assay', 'choice-assay',
      'courtship-index', 'fertility-assay', 'oral-feeding', 'dsRNA-delivery',

      // Claude v7 methods — insect bioassays / delivery
      'microinjection', 'dsRNA-soaking', 'electroporation', 'hemocoel',
    ],
    discussion: [
      // Population/evolutionary biology applied to pest contexts
      'selective-sweep', 'balancing-selection', 'purifying-selection', 'directional-selection',
      'ratchet', 'Muller-ratchet', 'mutational-meltdown', 'gene-conversion',
      'polyploidy', 'allopolyploid', 'autopolyploid',
      // Pest management
      'broader-impact', 'public-health', 'agricultural-relevance', 'integrated-pest-management',
      'ecological-engineering', 'push-pull', 'sterile-insect', 'RNAi-based-control',
      'biocontrol', 'parasitoid-mediated', 'entomopathogenic', 'microbial-pesticide',
    ],
  },
  phrases: {},
}
