import type { VocabPack } from '../sci-vocab'

export const imradMethodsPack: VocabPack = {
  id: 'imrad-methods',
  name: 'IMRaD · Methods',
  description: '实验方法段落常用动词、试剂、仪器与样品处理词汇。',
  builtin: true,
  defaultEnabled: true,
  words: {
    methods: [
      // Original
      'aliquot', 'vortex', 'centrifuge', 'centrifugation', 'supernatant',
      'pellet', 'titrate', 'electrophoresis', 'electrophorese', 'sonicate',
      'sonication', 'homogenize', 'homogenate', 'lyophilize', 'resuspend',
      'aspirate', 'dispense', 'inoculate', 'propagate', 'harvest', 'dissect',
      'dissection', 'excise', 'permeabilize', 'fixative', 'paraformaldehyde',
      'PFA', 'cryosection', 'paraffin section', 'immunostain', 'counterstain',
      'DAPI', 'Hoechst', 'Western blot', 'immunoblot', 'Northern blot',
      'Southern blot', 'immunohistochemistry', 'IHC', 'immunofluorescence', 'IF',
      'in situ hybridization', 'FISH', 'flow cytometry', 'FACS',
      'mass spectrometry', 'LC-MS', 'agarose gel', 'polyacrylamide',
      'SDS-PAGE', 'BCA assay', 'Bradford assay',
      'microtome', 'micropipette', 'trypsinize', 'transfect',
      'electroporate', 'microinject', 'ligate', 'ligation', 'restriction enzyme',
      'restriction digest', 'gel extraction', 'Gibson assembly', 'In-Fusion',
      'anesthetize', 'euthanize', 'genotype', 'multiplex', 'demultiplex',
      'oligo', 'elute', 'equilibrate', 'fractionate', 'solubilize', 'denature',
      'anneal', 'subclone', 'scaffold', 'contig',

      // v6 expansion (generic lab methods)
      'reconstitute', 'rehydrate', 'quench', 'lyse', 'dialyze',
      'concentrate', 'precipitate', 'snap-freeze', 'fixation', 'cryosectioning',
      'microdissect', 'immunolabel', 'chromatography', 'fractionation', 'eluate',
      'perfuse', 'reagent', 'substrate', 'fluorophore', 'coverslip',
      'lysate', 'antibody-conjugate', 'lysis-buffer', 'trypsin', 'proteinase-K',
      'DTT', 'EDTA', 'BSA', 'PBS', 'SYBR',
      'Coomassie', 'normalize', 'transform', 'scale',
      'patch-clamp', 'optogenetics', 'DREADD',
      'two-photon', 'super-resolution', 'FRET', 'immunoprecipitate', 'co-immunoprecipitate',
      'proximity-labeling', 'SILAC',

      // Claude v7 additions (qPCR / generic wet-lab)
      'ΔΔCt', 'primer-BLAST', 'melt-curve', 'no-template-control', 'no-RT-control',
    ],
  },
  phrases: {
    methods: [
      { trigger: 'as previously', text: 'as previously described' },
      { trigger: 'according to', text: 'according to the manufacturer\'s instructions' },
      { trigger: 'with minor', text: 'with minor modifications' },
      { trigger: 'in biological', text: 'in biological triplicate' },
      { trigger: 'in technical', text: 'in technical triplicate' },
      { trigger: 'data are presented', text: 'Data are presented as mean ± SEM' },
      { trigger: 'mean plus minus', text: 'mean ± SEM' },
      { trigger: 'p less than', text: 'P < 0.05' },
    ],
  },
}
