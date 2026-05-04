// Built-in pack metadata used by the main process. The full word/phrase
// content lives in src/data/vocab-packs/*.ts (renderer-side); only id/name/
// description/defaultEnabled are mirrored here so listVocabPacks and the
// MCP tools can describe builtin packs without bundling the renderer code.
//
// Keep IDs in sync with src/data/vocab-packs/index.ts. tests/vocab_pack_smoke
// asserts the IDs match.

const BUILTIN_PACK_META = [
  {
    id: 'core-academic',
    name: '学术写作核心',
    description: '连接词、副词、通用学术动词与高频学术词。任何学科都用得上的基础语汇。',
    defaultEnabled: true,
  },
  {
    id: 'molecular-biology',
    name: '分子生物学（通用）',
    description: 'RNA/DNA、CRISPR、PCR、克隆载体、转录组、细胞与信号通路、免疫、病毒、生化、纳米与方法学等通用术语。',
    defaultEnabled: true,
  },
  {
    id: 'imrad-introduction',
    name: 'IMRaD · Introduction',
    description: '前言段落常用的假设、引述、研究空白、研究意义类词汇与短语。',
    defaultEnabled: true,
  },
  {
    id: 'imrad-methods',
    name: 'IMRaD · Methods',
    description: '实验方法段落常用动词、试剂、仪器与样品处理词汇。',
    defaultEnabled: true,
  },
  {
    id: 'imrad-results',
    name: 'IMRaD · Results',
    description: '结果段落常用的差异表达、显著性、对照、剂量响应、图表类描述词。',
    defaultEnabled: true,
  },
  {
    id: 'imrad-discussion',
    name: 'IMRaD · Discussion',
    description: '讨论段落常用的解释、推论、局限、含义、展望类词汇与短语。',
    defaultEnabled: true,
  },
  {
    id: 'bioinformatics-tools',
    name: '生信工具',
    description: '比对/组装/差异表达/单细胞/系统发生/基因组注释等生信流程工具与机器学习术语。',
    defaultEnabled: false,
  },
  {
    id: 'statistics-methods',
    name: '统计方法',
    description: '检验、回归、多重比较、贝叶斯、效应量、模型评估等统计与定量分析术语。',
    defaultEnabled: false,
  },
  {
    id: 'lepidoptera-insect',
    name: '鳞翅目昆虫学',
    description: 'Chilo / Bombyx / Spodoptera 等模式昆虫与发育、内分泌、抗性、化学感受相关词汇。',
    defaultEnabled: false,
  },
  {
    id: 'sex-determination',
    name: '性别决定与发育',
    description: 'doublesex / DMRT / fruitless / transformer / Sxl 等性别决定与生殖发育术语。',
    defaultEnabled: false,
  },
  {
    id: 'epigenetics-rna',
    name: '表观遗传与 RNA',
    description: 'piRNA / m6A / lncRNA / circRNA / methylation / Argonaute / Piwi / ChIP-seq / ATAC-seq 等表观与 RNA 调控术语。',
    defaultEnabled: false,
  },
];

const BUILTIN_PACK_IDS = BUILTIN_PACK_META.map((p) => p.id);

module.exports = { BUILTIN_PACK_META, BUILTIN_PACK_IDS };
