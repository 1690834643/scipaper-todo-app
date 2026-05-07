const os = require('os');
const path = require('path');

const SECTION_TYPES = [
  'Title',
  'Abstract',
  'Introduction',
  'MaterialsAndMethods',
  'Results',
  'Discussion',
  'References',
];

const ARTICLE_STATUSES = [
  'Drafting',
  'Submitted',
  'UnderReview',
  'Revision',
  'Resubmitted',
  'Accepted',
  'Rejected',
  'Published',
];

const THESIS_STATUSES = [
  'Proposal',
  'InProgress',
  'DefenseReady',
  'Defended',
  'Revised',
  'Final',
];

const THESIS_SECTION_TYPES = [
  'Cover',
  'Declaration',
  'Abstract',
  'Acknowledgements',
  'TableOfContents',
  'ListOfFigures',
  'ListOfTables',
  'Chapter',
  'Conclusion',
  'References',
  'Appendix',
];

const THESIS_SECTION_TITLES = {
  Cover: '封面',
  Declaration: '原创性声明',
  Abstract: '摘要',
  Acknowledgements: '致谢',
  TableOfContents: '目录',
  ListOfFigures: '图目录',
  ListOfTables: '表目录',
  Chapter: '章节',
  Conclusion: '结论',
  References: '参考文献',
  Appendix: '附录',
};

const DEGREE_TYPES = ['Master', 'PhD'];

const BASE_DIRECTORY = path.join(os.homedir(), 'Documents', 'SciPaperTodo');
const ARTICLES_DIRECTORY = path.join(BASE_DIRECTORY, 'Articles');
const DATABASE_PATH = path.join(BASE_DIRECTORY, 'database.json');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.tif', '.tiff']);
const PDF_EXTENSIONS = new Set(['.pdf']);
const THESES_DIRECTORY = path.join(BASE_DIRECTORY, 'Theses');
const DEFAULT_ITALIC_PROMPT =
  '在生成或修改科研写作正文时,自动按学术英语惯例对以下内容标注斜体(用 markdown *text*):' +
  '\n- 物种学名(属种二项式,如 *Chilo suppressalis*),属名首字母大写,种名小写' +
  '\n- 拉丁短语(in vitro / in vivo / ex vivo / de novo / et al. / vs. / e.g. / i.e. / per se / via)' +
  '\n- 统计变量符号(p, t, F, r, n, N, df, χ²),例如 *p* < 0.05' +
  '\n- 基因符号(按物种约定:果蝇基因斜体小写如 *hsp70*;蛋白正体大写如 HSP70)' +
  '\n- 数学常量符号(*e* 自然常数,*i* 虚数,*x* 自变量等)' +
  '\n规则不必穷举,你应当依据学术英语规范主动识别并标注。中文写作中,这些专有术语在中文里也保持斜体英文形式(中文不变)。';

module.exports = {
  SECTION_TYPES,
  ARTICLE_STATUSES,
  THESIS_STATUSES,
  THESIS_SECTION_TYPES,
  THESIS_SECTION_TITLES,
  DEGREE_TYPES,
  BASE_DIRECTORY,
  ARTICLES_DIRECTORY,
  DATABASE_PATH,
  IMAGE_EXTENSIONS,
  PDF_EXTENSIONS,
  THESES_DIRECTORY,
  DEFAULT_ITALIC_PROMPT,
};
