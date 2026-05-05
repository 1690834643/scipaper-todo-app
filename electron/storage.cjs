const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { PRESETS } = require('./llmPresets.cjs');
const { localIsoDate } = require('./dateUtils.cjs');

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

function now() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function ensureStore() {
  fs.mkdirSync(ARTICLES_DIRECTORY, { recursive: true });
  fs.mkdirSync(THESES_DIRECTORY, { recursive: true });

  if (!fs.existsSync(DATABASE_PATH)) {
    fs.writeFileSync(
      DATABASE_PATH,
      JSON.stringify({
        version: 1,
        articles: [],
        theses: [],
        writingStreak: {
          currentStreak: 0,
          longestStreak: 0,
          lastWriteDate: null,
          totalWritingDays: 0,
          todayWords: 0,
        dailyGoal: 500,
        streakHistory: [],
        moodHistory: [],
      },
    }, null, 2),
      'utf-8',
    );
  }
}

function readDatabase() {
  ensureStore();
  // Recover from a crashed write: if main file gone but .bak exists, promote .bak
  if (!fs.existsSync(DATABASE_PATH) && fs.existsSync(DATABASE_PATH + '.bak')) {
    fs.copyFileSync(DATABASE_PATH + '.bak', DATABASE_PATH);
  }
  const raw = fs.readFileSync(DATABASE_PATH, 'utf-8');
  try {
    return normalizeStoredDatabase(JSON.parse(raw));
  } catch (error) {
    if (!fs.existsSync(DATABASE_PATH + '.bak')) {
      throw error;
    }
    try {
      const backupRaw = fs.readFileSync(DATABASE_PATH + '.bak', 'utf-8');
      const backup = JSON.parse(backupRaw);
      fs.copyFileSync(DATABASE_PATH + '.bak', DATABASE_PATH);
      return normalizeStoredDatabase(backup);
    } catch {
      throw error;
    }
  }
}

let lastBackupAt = 0;
const BACKUP_INTERVAL_MS = 5 * 60 * 1000;

// Inter-process write guard for the GUI ↔ WSL MCP scenario. Sentinel-file lock:
// a writer creates `database.json.lock` (O_CREAT|O_EXCL); a concurrent writer
// sees it and aborts. Stale locks (>30s) are reclaimed; both writers crash-safe
// because the .tmp + rename atomic write is unchanged.
const STALE_LOCK_MS = 30_000;

function acquireWriteLock() {
  const lockPath = DATABASE_PATH + '.lock';
  try {
    return { fd: fs.openSync(lockPath, 'wx'), path: lockPath };
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    let stat = null;
    try { stat = fs.statSync(lockPath); } catch {}
    if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
      try { fs.unlinkSync(lockPath); } catch {}
      return { fd: fs.openSync(lockPath, 'wx'), path: lockPath };
    }
    const ageMs = stat ? Date.now() - stat.mtimeMs : -1;
    throw new Error(
      'database is locked by another writer (' + lockPath + ', age ' + ageMs + 'ms). ' +
      'Close the other SciPaper Todo writer (GUI app or WSL MCP) and retry. ' +
      'If stuck, delete the .lock file manually.',
    );
  }
}

function releaseWriteLock(lock) {
  if (!lock) return;
  try { fs.closeSync(lock.fd); } catch {}
  try { fs.unlinkSync(lock.path); } catch {}
}

function writeDatabase(data) {
  ensureStore();
  const json = JSON.stringify(normalizeStoredDatabase(data), null, 2);
  const tmpPath = DATABASE_PATH + '.tmp';
  const lock = acquireWriteLock();
  try {
    fs.writeFileSync(tmpPath, json, 'utf-8');
    // Snapshot last good copy at most every BACKUP_INTERVAL_MS
    if (fs.existsSync(DATABASE_PATH) && Date.now() - lastBackupAt > BACKUP_INTERVAL_MS) {
      try {
        fs.copyFileSync(DATABASE_PATH, DATABASE_PATH + '.bak');
        lastBackupAt = Date.now();
      } catch {}
    }
    // Atomic on POSIX; Node fs.renameSync replaces target on Windows too
    fs.renameSync(tmpPath, DATABASE_PATH);
  } finally {
    releaseWriteLock(lock);
  }
}

function createArticleFolder(articleId) {
  const articleRoot = path.join(ARTICLES_DIRECTORY, articleId);
  fs.mkdirSync(path.join(articleRoot, 'Attachments'), { recursive: true });
  fs.mkdirSync(path.join(articleRoot, 'Exports'), { recursive: true });
  return articleRoot;
}

function createThesisFolder(thesisId) {
  const thesisRoot = path.join(THESES_DIRECTORY, thesisId);
  fs.mkdirSync(path.join(thesisRoot, 'Attachments'), { recursive: true });
  fs.mkdirSync(path.join(thesisRoot, 'Exports'), { recursive: true });
  return thesisRoot;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBlockType(type) {
  const normalized = String(type || '').toLowerCase();

  if (normalized === 'text') {
    return 'Text';
  }

  if (normalized === 'image') {
    return 'Image';
  }

  if (normalized === 'filelink' || normalized === 'file') {
    return 'FileLink';
  }

  return type;
}

function normalizeStoredBlock(block) {
  const versions = Array.isArray(block.versions) ? block.versions : [];
  return {
    ...block,
    type: normalizeBlockType(block.type),
    versions,
  };
}

function normalizeStreakHistoryEntry(entry = {}) {
  return {
    ...entry,
    date: typeof entry.date === 'string' ? entry.date : '',
    words: Number.isFinite(entry.words) ? entry.words : 0,
    addedWords: Number.isFinite(entry.addedWords) ? entry.addedWords : 0,
    removedWords: Number.isFinite(entry.removedWords) ? entry.removedWords : 0,
    changedWords: Number.isFinite(entry.changedWords) ? entry.changedWords : 0,
    byAI: Number.isFinite(entry.byAI) ? entry.byAI : 0,
    byManual: Number.isFinite(entry.byManual) ? entry.byManual : 0,
    goalMet: typeof entry.goalMet === 'boolean' ? entry.goalMet : false,
  };
}

function normalizeWritingStreak(streak = {}) {
  return {
    currentStreak: Number.isFinite(streak.currentStreak) ? streak.currentStreak : 0,
    longestStreak: Number.isFinite(streak.longestStreak) ? streak.longestStreak : 0,
    lastWriteDate: typeof streak.lastWriteDate === 'string' ? streak.lastWriteDate : null,
    totalWritingDays: Number.isFinite(streak.totalWritingDays) ? streak.totalWritingDays : 0,
    todayWords: Number.isFinite(streak.todayWords) ? streak.todayWords : 0,
    todayAddedWords: Number.isFinite(streak.todayAddedWords) ? streak.todayAddedWords : 0,
    todayRemovedWords: Number.isFinite(streak.todayRemovedWords) ? streak.todayRemovedWords : 0,
    todayChangedWords: Number.isFinite(streak.todayChangedWords) ? streak.todayChangedWords : 0,
    todayByAI: Number.isFinite(streak.todayByAI) ? streak.todayByAI : 0,
    todayByManual: Number.isFinite(streak.todayByManual) ? streak.todayByManual : 0,
    dailyGoal: Number.isFinite(streak.dailyGoal) && streak.dailyGoal > 0 ? streak.dailyGoal : 500,
    streakHistory: Array.isArray(streak.streakHistory)
      ? streak.streakHistory.map(normalizeStreakHistoryEntry)
      : [],
    moodHistory: Array.isArray(streak.moodHistory) ? streak.moodHistory : [],
  };
}

function ensureDefaultProviders(arr) {
  if (arr.length === 0) {
    return PRESETS.map((preset) => {
      const timestamp = new Date().toISOString();
      const maxTokens = normalizeMaxTokens(preset.maxTokens ?? preset.defaultMaxTokens);

      const provider = {
        id: preset.presetId,
        name: preset.name,
        kind: preset.kind,
        baseUrl: preset.baseUrl,
        model: preset.model ?? preset.defaultModel,
        temperature: preset.temperature ?? 0.3,
        supportsToolUse: preset.supportsToolUse ?? false,
        trustForWrite: preset.trustForWrite ?? false,
        createdAt: timestamp,
        updatedAt: timestamp,
        presetId: preset.presetId,
      };

      if (maxTokens !== undefined) provider.maxTokens = maxTokens;
      return provider;
    });
  }

  return arr;
}

function normalizeMaxTokens(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function normalizeLlmProviders(arr) {
  if (!Array.isArray(arr)) {
    return ensureDefaultProviders([]);
  }

  const providers = arr
    .map((provider) => {
      if (typeof provider?.id !== 'string') {
        return null;
      }

      const normalized = {
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: provider.model,
        temperature: provider.temperature,
        supportsToolUse: provider.supportsToolUse,
        trustForWrite: provider.trustForWrite,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
        presetId: provider.presetId,
      };

      const maxTokens = normalizeMaxTokens(provider.maxTokens);
      if (maxTokens !== undefined) normalized.maxTokens = maxTokens;
      return normalized;
    })
    .filter(Boolean);

  return ensureDefaultProviders(providers);
}

function ensureDefaultScenarios(arr) {
  if (arr.length === 0) {
    try {
      const { BUILTIN_SCENARIOS } = require('./writingScenarios.cjs');
      return Array.isArray(BUILTIN_SCENARIOS) ? BUILTIN_SCENARIOS.map((scenario) => ({ ...scenario })) : [];
    } catch {
      return [];
    }
  }

  return arr;
}

function normalizeWritingScenarios(arr) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return ensureDefaultScenarios([]);
  }

  return ensureDefaultScenarios(arr);
}

function normalizeItalicGuide(obj = {}) {
  return {
    prompt: typeof obj.prompt === 'string' ? obj.prompt : DEFAULT_ITALIC_PROMPT,
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
  };
}

function normalizeZoteroConfig(obj = {}) {
  return {
    endpoint: typeof obj.endpoint === 'string' ? obj.endpoint : 'http://localhost:23119',
    userId: typeof obj.userId === 'string' ? obj.userId : '0',
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : false,
  };
}

const { BUILTIN_PACK_IDS } = require('./vocabPackRegistry.cjs');
const VOCAB_SECTIONS = ['general', 'introduction', 'methods', 'results', 'discussion'];

// User-defined autocomplete vocabulary. Merged with the built-in SCI_WORDS /
// SCI_PHRASES at frontend AutocompleteExtension config time. Stored flat;
// every entry surfaces in the `general` bucket so it shows up regardless of
// the active section. Entries dedupe case-insensitively against existing
// content on add.
function normalizeCustomVocab(obj = {}) {
  const rawWords = Array.isArray(obj.words) ? obj.words : [];
  const rawPhrases = Array.isArray(obj.phrases) ? obj.phrases : [];
  const words = [];
  const seenWords = new Set();
  for (const w of rawWords) {
    if (typeof w !== 'string') continue;
    const trimmed = w.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seenWords.has(key)) continue;
    seenWords.add(key);
    words.push(trimmed);
  }
  const phrases = [];
  const seenPhrases = new Set();
  for (const p of rawPhrases) {
    if (!p || typeof p !== 'object') continue;
    const trigger = typeof p.trigger === 'string' ? p.trigger.trim() : '';
    const text = typeof p.text === 'string' ? p.text.trim() : '';
    if (!trigger || !text) continue;
    const key = trigger.toLowerCase() + '|' + text.toLowerCase();
    if (seenPhrases.has(key)) continue;
    seenPhrases.add(key);
    const entry = { trigger, text };
    if (typeof p.label === 'string' && p.label.trim()) {
      entry.label = p.label.trim();
    }
    phrases.push(entry);
  }
  return { words, phrases };
}

// User-imported vocab packs. Each pack carries its own words/phrases per
// IMRaD section. Builtin packs live in src/data/vocab-packs/ on the
// renderer side; here we only persist user-imported ones plus a per-id
// enabled override for both kinds.
function normalizeImportedVocabPack(obj = {}) {
  const id = typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : '';
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : 'Untitled pack';
  const description = typeof obj.description === 'string' ? obj.description.trim() : '';
  const wordsBucket = obj.words && typeof obj.words === 'object' && !Array.isArray(obj.words)
    ? obj.words
    : { general: Array.isArray(obj.words) ? obj.words : [] };
  const phrasesBucket = obj.phrases && typeof obj.phrases === 'object' && !Array.isArray(obj.phrases)
    ? obj.phrases
    : { general: Array.isArray(obj.phrases) ? obj.phrases : [] };

  const words = {};
  const phrases = {};
  for (const section of VOCAB_SECTIONS) {
    const wRaw = Array.isArray(wordsBucket[section]) ? wordsBucket[section] : [];
    const wOut = [];
    const wSeen = new Set();
    for (const entry of wRaw) {
      if (typeof entry !== 'string') continue;
      const trimmed = entry.trim();
      if (!trimmed) continue;
      if (trimmed.length > 60) continue;
      const key = trimmed.toLowerCase();
      if (wSeen.has(key)) continue;
      wSeen.add(key);
      wOut.push(trimmed);
    }
    if (wOut.length) words[section] = wOut;

    const pRaw = Array.isArray(phrasesBucket[section]) ? phrasesBucket[section] : [];
    const pOut = [];
    const pSeen = new Set();
    for (const entry of pRaw) {
      if (!entry || typeof entry !== 'object') continue;
      const trigger = typeof entry.trigger === 'string' ? entry.trigger.trim() : '';
      const text = typeof entry.text === 'string' ? entry.text.trim() : '';
      if (!trigger || !text) continue;
      if (trigger.length > 30 || text.length > 160) continue;
      const key = trigger.toLowerCase();
      if (pSeen.has(key)) continue;
      pSeen.add(key);
      const out = { trigger, text };
      if (typeof entry.label === 'string' && entry.label.trim()) out.label = entry.label.trim();
      pOut.push(out);
    }
    if (pOut.length) phrases[section] = pOut;
  }

  const generatedId = 'custom-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const safeId = id && !BUILTIN_PACK_IDS.includes(id) ? id : generatedId;

  return {
    id: safeId,
    name: name.length > 60 ? name.slice(0, 60) : name,
    description: description.length > 200 ? description.slice(0, 200) : description,
    builtin: false,
    defaultEnabled: typeof obj.defaultEnabled === 'boolean' ? obj.defaultEnabled : true,
    words,
    phrases,
  };
}

function normalizeVocabPackPrefs(obj = {}) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof k !== 'string' || !k.trim()) continue;
    if (typeof v !== 'boolean') continue;
    out[k] = v;
  }
  return out;
}

function normalizeCustomVocabPacks(arr = []) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of arr) {
    const pack = normalizeImportedVocabPack(entry);
    if (seen.has(pack.id)) continue;
    seen.add(pack.id);
    out.push(pack);
  }
  return out;
}

function normalizeFinding(finding = {}) {
  const validStatus = ['planned', 'inProgress', 'done'];
  return {
    id: typeof finding.id === 'string' ? finding.id : createId(),
    sectionId: typeof finding.sectionId === 'string' ? finding.sectionId : '',
    title: normalizeText(finding.title),
    description: normalizeText(finding.description),
    status: validStatus.includes(finding.status) ? finding.status : 'planned',
    orderIndex: Number.isFinite(finding.orderIndex) ? finding.orderIndex : 0,
    createdAt: typeof finding.createdAt === 'string' ? finding.createdAt : now(),
    updatedAt: typeof finding.updatedAt === 'string' ? finding.updatedAt : now(),
  };
}

function normalizeProgressEntry(entry = {}) {
  const validKinds = ['read', 'experiment', 'writing', 'idea', 'cite', 'analysis', 'focus', 'mood'];
  return {
    id: typeof entry.id === 'string' ? entry.id : createId(),
    date: typeof entry.date === 'string' ? entry.date : localIsoDate(),
    articleId: typeof entry.articleId === 'string' ? entry.articleId : '',
    kind: validKinds.includes(entry.kind) ? entry.kind : 'idea',
    title: normalizeText(entry.title),
    detail: normalizeText(entry.detail),
    sectionId: typeof entry.sectionId === 'string' ? entry.sectionId : undefined,
    findingId: typeof entry.findingId === 'string' ? entry.findingId : undefined,
    citationId: typeof entry.citationId === 'string' ? entry.citationId : undefined,
    minutesSpent: Number.isFinite(entry.minutesSpent) ? entry.minutesSpent : undefined,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : now(),
    createdBy: entry.createdBy === 'ai' ? 'ai' : 'user',
  };
}

function normalizeDailySession(session = {}) {
  return {
    date: typeof session.date === 'string' ? session.date : localIsoDate(),
    planText: normalizeText(session.planText),
    summaryText: normalizeText(session.summaryText),
    startedAt: typeof session.startedAt === 'string' ? session.startedAt : now(),
    endedAt: typeof session.endedAt === 'string' ? session.endedAt : undefined,
    progressEntryIds: Array.isArray(session.progressEntryIds) ? session.progressEntryIds.filter((id) => typeof id === 'string') : [],
  };
}

function normalizeImportBatch(batch = {}) {
  return {
    id: typeof batch.id === 'string' ? batch.id : createId(),
    articleId: typeof batch.articleId === 'string' ? batch.articleId : '',
    kind: batch.kind === 'review' ? 'review' : 'manuscript',
    sourceName: normalizeText(batch.sourceName),
    createdAt: typeof batch.createdAt === 'string' ? batch.createdAt : now(),
    blockIds: Array.isArray(batch.blockIds) ? batch.blockIds.filter((id) => typeof id === 'string') : [],
    commentIds: Array.isArray(batch.commentIds) ? batch.commentIds.filter((id) => typeof id === 'string') : [],
    roundIds: Array.isArray(batch.roundIds) ? batch.roundIds.filter((id) => typeof id === 'string') : [],
  };
}

function normalizeStoredDatabase(data) {
  return {
    version: data.version ?? 1,
    articles: (data.articles ?? []).map((article) => ({
      ...article,
      sections: (article.sections ?? []).map((section) => ({
        ...section,
        contentBlocks: (section.contentBlocks ?? []).map(normalizeStoredBlock),
        findings: Array.isArray(section.findings) ? section.findings.map(normalizeFinding) : [],
      })),
      reviewRounds: article.reviewRounds ?? [],
      citations: article.citations ?? [],
    })),
    theses: (data.theses ?? []).map((thesis) => ({
      ...thesis,
      sections: (thesis.sections ?? []).map((section) => ({
        ...section,
        contentBlocks: (section.contentBlocks ?? []).map(normalizeStoredBlock),
      })),
    })),
    writingStreak: normalizeWritingStreak(data.writingStreak),
    pomodoroSessions: data.pomodoroSessions ?? [],
    theme: data.theme ?? 'claude',
    llmProviders: normalizeLlmProviders(data.llmProviders),
    activeLlmProviderId: typeof data.activeLlmProviderId === 'string' ? data.activeLlmProviderId : null,
    writingScenarios: normalizeWritingScenarios(data.writingScenarios),
    italicGuide: normalizeItalicGuide(data.italicGuide),
    zoteroConfig: normalizeZoteroConfig(data.zoteroConfig),
    progressEntries: Array.isArray(data.progressEntries) ? data.progressEntries.map(normalizeProgressEntry) : [],
    dailySessions: Array.isArray(data.dailySessions) ? data.dailySessions.map(normalizeDailySession) : [],
    importBatches: Array.isArray(data.importBatches) ? data.importBatches.map(normalizeImportBatch) : [],
    autoApproveTools: typeof data.autoApproveTools === 'boolean' ? data.autoApproveTools : false,
    customVocab: normalizeCustomVocab(data.customVocab),
    vocabPackPrefs: normalizeVocabPackPrefs(data.vocabPackPrefs),
    customVocabPacks: normalizeCustomVocabPacks(data.customVocabPacks),
    userProfile: normalizeUserProfile(data.userProfile),
  };
}

// User profile — name shown in the sidebar brand slot and prepended to time-of-day
// greetings. Empty string means "no name set" (UI falls back to defaults).
function normalizeUserProfile(obj = {}) {
  if (!obj || typeof obj !== 'object') obj = {};
  const raw = typeof obj.displayName === 'string' ? obj.displayName.trim() : '';
  // Cap at 40 chars to avoid sidebar layout overflow.
  return { displayName: raw.length > 40 ? raw.slice(0, 40) : raw };
}

function isWindowsAbsolutePath(value) {
  return /^[a-zA-Z]:[\\/]/.test(value);
}

function normalizeRelativeAssetPath(value) {
  return value.split(/[\\/]+/).filter(Boolean).join(path.sep);
}

// macOS 用户从 Windows 备份导入数据库时，block.content 里可能保留 `C:\...`
// 绝对路径。WSL 下能通过 /mnt/c 还原，但 macOS 没有这个映射，硬试会拼出
// 不存在的路径。返回 null 让 enrichBlock 标记 assetError，提示用户重新关联。
const WINDOWS_IMPORT_RELINK_MESSAGE =
  'This attachment was imported from Windows; please re-link it on this Mac.';
const warnedWindowsImportPaths = new Set();

function warnWindowsImportPath(value) {
  if (warnedWindowsImportPaths.has(value)) return;
  warnedWindowsImportPaths.add(value);
  console.warn(WINDOWS_IMPORT_RELINK_MESSAGE + ' Original path: ' + value);
}

function windowsPathToCurrentPlatform(value) {
  if (process.platform === 'win32') {
    return value;
  }

  if (process.platform === 'darwin') {
    warnWindowsImportPath(value);
    return null;
  }

  const drive = value[0].toLowerCase();
  const rest = value.slice(2).split(/[\\/]+/).filter(Boolean);
  return path.join('/mnt', drive, ...rest);
}

function getAssetPathError(block) {
  if (normalizeBlockType(block.type) === 'Text') return null;
  if (process.platform === 'darwin' && isWindowsAbsolutePath(block.content)) {
    warnWindowsImportPath(block.content);
    return WINDOWS_IMPORT_RELINK_MESSAGE;
  }
  return null;
}

function createSection(type, orderIndex) {
  return {
    id: createId(),
    type,
    orderIndex,
    contentBlocks: [],
  };
}

function createThesisSection(thesisId, type, orderIndex, title) {
  return {
    id: createId(),
    thesisId,
    type,
    title: normalizeText(title) || THESIS_SECTION_TITLES[type] || type,
    orderIndex,
    contentBlocks: [],
  };
}

function createTextVersion(content, modifiedBy, changeDescription) {
  return {
    id: createId(),
    content,
    modifiedAt: now(),
    modifiedBy,
    changeDescription,
  };
}

function createArticle(input) {
  const database = readDatabase();
  const timestamp = now();
  const articleId = createId();

  const article = {
    id: articleId,
    title: normalizeText(input.title) || '未命名研究',
    targetJournal: normalizeText(input.targetJournal),
    status: ARTICLE_STATUSES.includes(input.status) ? input.status : 'Drafting',
    language: input.language === 'zh' ? 'zh' : 'en',
    createdAt: timestamp,
    updatedAt: timestamp,
    researchContext: {
      id: createId(),
      articleId,
      scientificQuestion: normalizeText(input.researchContext?.scientificQuestion),
      observedPhenomenon: normalizeText(input.researchContext?.observedPhenomenon),
      hypothesis: normalizeText(input.researchContext?.hypothesis),
      approach: normalizeText(input.researchContext?.approach),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    sections: SECTION_TYPES.map((type, index) => createSection(type, index)),
    reviewRounds: [],
    citations: [],
    tags: [],
  };

  database.articles.unshift(article);
  createArticleFolder(articleId);
  writeDatabase(database);

  return article;
}

function createThesis(input) {
  const database = readDatabase();
  const timestamp = now();
  const thesisId = createId();

  const thesis = {
    id: thesisId,
    title: normalizeText(input.title) || '未命名论文',
    titleEn: normalizeText(input.titleEn),
    author: normalizeText(input.author),
    supervisor: normalizeText(input.supervisor),
    institution: normalizeText(input.institution),
    department: normalizeText(input.department),
    degree: DEGREE_TYPES.includes(input.degree) ? input.degree : 'Master',
    status: THESIS_STATUSES.includes(input.status) ? input.status : 'Proposal',
    createdAt: timestamp,
    updatedAt: timestamp,
    articleIds: input.articleIds ?? [],
    sections: THESIS_SECTION_TYPES.map((type, index) => createThesisSection(thesisId, type, index)),
    abstractZh: normalizeText(input.abstractZh),
    abstractEn: normalizeText(input.abstractEn),
    keywords: input.keywords ?? [],
  };

  database.theses.unshift(thesis);
  createThesisFolder(thesisId);
  writeDatabase(database);

  return thesis;
}

function findThesis(database, thesisId) {
  const thesis = database.theses.find((item) => item.id === thesisId);

  if (!thesis) {
    throw new Error('Thesis not found');
  }

  return thesis;
}

function touchThesis(thesis) {
  thesis.updatedAt = now();
}

function updateThesisMeta(thesisId, patch) {
  const database = readDatabase();
  const thesis = findThesis(database, thesisId);

  thesis.title = normalizeText(patch.title) || thesis.title;
  thesis.titleEn = normalizeText(patch.titleEn) ?? thesis.titleEn;
  thesis.author = normalizeText(patch.author) || thesis.author;
  thesis.supervisor = normalizeText(patch.supervisor) || thesis.supervisor;
  thesis.institution = normalizeText(patch.institution) || thesis.institution;
  thesis.department = normalizeText(patch.department) || thesis.department;
  thesis.degree = DEGREE_TYPES.includes(patch.degree) ? patch.degree : thesis.degree;
  thesis.status = THESIS_STATUSES.includes(patch.status) ? patch.status : thesis.status;
  thesis.abstractZh = normalizeText(patch.abstractZh) ?? thesis.abstractZh;
  thesis.abstractEn = normalizeText(patch.abstractEn) ?? thesis.abstractEn;
  thesis.keywords = patch.keywords ?? thesis.keywords;
  touchThesis(thesis);

  writeDatabase(database);
}

function addThesisSection(thesisId, sectionType, title) {
  const database = readDatabase();
  const thesis = findThesis(database, thesisId);

  if (!THESIS_SECTION_TYPES.includes(sectionType)) {
    throw new Error(`Invalid thesis section type: ${sectionType}`);
  }

  const section = createThesisSection(thesisId, sectionType, thesis.sections.length, title);
  thesis.sections.push(section);
  touchThesis(thesis);

  writeDatabase(database);
}

function linkArticleToThesis(thesisId, articleId) {
  const database = readDatabase();
  const thesis = findThesis(database, thesisId);
  const article = findArticle(database, articleId);

  if (!thesis.articleIds.includes(articleId)) {
    thesis.articleIds.push(articleId);
  }
  touchThesis(thesis);

  writeDatabase(database);
}

function unlinkArticleFromThesis(thesisId, articleId) {
  const database = readDatabase();
  const thesis = findThesis(database, thesisId);

  thesis.articleIds = thesis.articleIds.filter((id) => id !== articleId);
  touchThesis(thesis);

  writeDatabase(database);
}

// Delete an article entirely: drops it from the articles array, removes its
// attachment directory under Articles/{articleId}/, and detaches it from any
// thesis that linked it. Progress entries that referenced this article keep
// their articleId untouched so historical activity stays auditable; the UI
// already shows them as orphaned ("article gone") when needed.
function deleteArticle(articleId) {
  if (typeof articleId !== 'string' || !articleId.trim()) {
    throw new Error('deleteArticle: articleId is required');
  }

  const database = readDatabase();
  const before = database.articles.length;
  database.articles = database.articles.filter((a) => a.id !== articleId);
  if (database.articles.length === before) {
    throw new Error('deleteArticle: article not found');
  }

  for (const thesis of database.theses) {
    if (Array.isArray(thesis.articleIds) && thesis.articleIds.includes(articleId)) {
      thesis.articleIds = thesis.articleIds.filter((id) => id !== articleId);
      touchThesis(thesis);
    }
  }

  writeDatabase(database);

  // Remove the per-article attachment / export directory if it exists. This
  // is intentionally best-effort — if the user moved files manually we still
  // succeed at the database delete.
  const articleDir = getArticleDirectory(articleId);
  try {
    if (fs.existsSync(articleDir)) {
      fs.rmSync(articleDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('deleteArticle: failed to remove attachments dir', articleDir, error);
  }
}

function updateDailyGoal(goal) {
  const database = readDatabase();

  if (typeof goal === 'number' && goal > 0) {
    database.writingStreak.dailyGoal = goal;
    writeDatabase(database);
  }
}

function normalizeWritingDelta(input) {
  if (Number.isFinite(input)) {
    return {
      added: Math.max(0, input),
      removed: 0,
      source: 'manual',
    };
  }

  const added = Number.isFinite(input?.added) ? input.added : 0;
  const removed = Number.isFinite(input?.removed) ? input.removed : 0;
  const source = String(input?.source || 'manual').toLowerCase() === 'ai' ? 'ai' : 'manual';

  return {
    added: Math.max(0, added),
    removed: Math.max(0, removed),
    source,
  };
}

function applyWritingStreak(streakInput, deltaInput) {
  const streak = normalizeWritingStreak(streakInput);
  const delta = normalizeWritingDelta(deltaInput);
  const changedWords = delta.added + delta.removed;

  if (changedWords <= 0) {
    return streak;
  }

  const netWords = delta.added - delta.removed;
  const today = localIsoDate();

  if (streak.lastWriteDate === today) {
    streak.todayWords += netWords;
    streak.todayAddedWords += delta.added;
    streak.todayRemovedWords += delta.removed;
    streak.todayChangedWords += changedWords;
    if (delta.source === 'ai') {
      streak.todayByAI += changedWords;
    } else {
      streak.todayByManual += changedWords;
    }
  } else {
    const yesterday = localIsoDate(new Date(Date.now() - 86400000));

    if (streak.lastWriteDate === yesterday) {
      streak.currentStreak += 1;
    } else if (streak.lastWriteDate !== today) {
      streak.currentStreak = 1;
    }

    streak.todayWords = netWords;
    streak.todayAddedWords = delta.added;
    streak.todayRemovedWords = delta.removed;
    streak.todayChangedWords = changedWords;
    streak.todayByAI = delta.source === 'ai' ? changedWords : 0;
    streak.todayByManual = delta.source === 'ai' ? 0 : changedWords;
    streak.lastWriteDate = today;
    streak.totalWritingDays += 1;
  }

  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
  }

  const goalMet = streak.todayWords >= streak.dailyGoal;
  const existingIndex = streak.streakHistory.findIndex((entry) => entry.date === today);

  if (existingIndex >= 0) {
    streak.streakHistory[existingIndex].words = streak.todayWords;
    streak.streakHistory[existingIndex].addedWords = streak.todayAddedWords;
    streak.streakHistory[existingIndex].removedWords = streak.todayRemovedWords;
    streak.streakHistory[existingIndex].changedWords = streak.todayChangedWords;
    streak.streakHistory[existingIndex].byAI = streak.todayByAI;
    streak.streakHistory[existingIndex].byManual = streak.todayByManual;
    streak.streakHistory[existingIndex].goalMet = goalMet;
  } else {
    streak.streakHistory.unshift({
      date: today,
      words: streak.todayWords,
      addedWords: streak.todayAddedWords,
      removedWords: streak.todayRemovedWords,
      changedWords: streak.todayChangedWords,
      byAI: streak.todayByAI,
      byManual: streak.todayByManual,
      goalMet,
    });
  }

  return streak;
}

function updateWritingStreak(wordCount) {
  const database = readDatabase();
  database.writingStreak = applyWritingStreak(database.writingStreak, wordCount);
  writeDatabase(database);

  return database.writingStreak;
}

function touchArticle(article) {
  article.updatedAt = now();
}

function findArticle(database, articleId) {
  const article = database.articles.find((item) => item.id === articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  return article;
}

function findSection(article, sectionType) {
  const section = article.sections.find((item) => item.type === sectionType);

  if (!section) {
    throw new Error(`Section ${sectionType} not found`);
  }

  return section;
}

function findBlock(article, blockId) {
  for (const section of article.sections) {
    const block = section.contentBlocks.find((item) => item.id === blockId);

    if (block) {
      return { section, block };
    }
  }

  throw new Error('Content block not found');
}

function getArticleDirectory(articleId) {
  if (typeof articleId !== 'string' || !articleId) {
    throw new Error('Invalid articleId');
  }
  const candidate = path.resolve(ARTICLES_DIRECTORY, articleId);
  const root = path.resolve(ARTICLES_DIRECTORY);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) {
    throw new Error('articleId resolves outside Articles directory');
  }
  return candidate;
}

function resolveBlockPath(articleId, block) {
  const blockType = normalizeBlockType(block.type);

  if (blockType === 'Text') {
    return null;
  }

  if (typeof block.content !== 'string' || !block.content) {
    return null;
  }

  let candidate;
  if (path.isAbsolute(block.content)) {
    candidate = block.content;
  } else if (isWindowsAbsolutePath(block.content)) {
    candidate = windowsPathToCurrentPlatform(block.content);
    if (candidate === null) return null;
  } else {
    candidate = path.join(getArticleDirectory(articleId), normalizeRelativeAssetPath(block.content));
  }

  // 安全：阻止路径遍历。block.content 可能来自历史数据或 LLM/MCP 工具输入，
  // 必须保证最终落点在该 article 目录内（含子目录），否则 IPC 暴露任意 fs 读取。
  const resolved = path.resolve(candidate);
  const root = path.resolve(getArticleDirectory(articleId));
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    return null;
  }

  return candidate;
}

function enrichBlock(articleId, block) {
  const normalizedBlock = normalizeStoredBlock(block);
  const assetError = getAssetPathError(normalizedBlock);
  const resolvedPath = resolveBlockPath(articleId, normalizedBlock);
  const stats = resolvedPath && fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null;

  return {
    ...normalizedBlock,
    assetError,
    resolvedPath,
    previewUrl: resolvedPath ? pathToFileURL(resolvedPath).toString() : null,
    fileName: resolvedPath ? path.basename(resolvedPath) : null,
    fileSize: stats?.isFile() ? stats.size : null,
  };
}

function enrichArticle(article) {
  return {
    ...article,
    sections: [...article.sections]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((section) => ({
        ...section,
        contentBlocks: [...section.contentBlocks]
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .map((block) => enrichBlock(article.id, block)),
      })),
    reviewRounds: [...article.reviewRounds].sort((left, right) => right.roundNumber - left.roundNumber),
  };
}

function addMoodEntry(mood, note = '') {
  const database = readDatabase();
  const today = localIsoDate();
  
  if (!database.writingStreak.moodHistory) {
    database.writingStreak.moodHistory = [];
  }
  
  database.writingStreak.moodHistory.push({
    id: createId(),
    date: today,
    mood,
    note: normalizeText(note),
    createdAt: now()
  });
  
  // Keep only last 365 days
  const oneYearAgo = localIsoDate(new Date(Date.now() - 365 * 86400000));
  database.writingStreak.moodHistory = database.writingStreak.moodHistory.filter(
    entry => entry.date >= oneYearAgo
  );
  
  writeDatabase(database);
  return database.writingStreak;
}

function getMoodHistory() {
  const database = readDatabase();
  return database.writingStreak.moodHistory || [];
}

function addPomodoroSession(duration, articleId = '', sectionType = '') {
  const database = readDatabase();
  const today = localIsoDate();
  
  if (!database.pomodoroSessions) {
    database.pomodoroSessions = [];
  }
  
  const session = {
    id: createId(),
    startTime: new Date(Date.now() - duration * 60000).toISOString(),
    endTime: now(),
    duration,
    completed: true,
    articleId: normalizeText(articleId),
    sectionType: normalizeText(sectionType)
  };
  
  database.pomodoroSessions.push(session);
  
  // Keep only last 365 days
  const oneYearAgo = localIsoDate(new Date(Date.now() - 365 * 86400000));
  database.pomodoroSessions = database.pomodoroSessions.filter(
    s => s.startTime >= oneYearAgo
  );
  
  writeDatabase(database);
  return session;
}

function getPomodoroStats() {
  const database = readDatabase();
  const sessions = database.pomodoroSessions || [];
  const today = localIsoDate();
  
  const todaySessions = sessions.filter(s => s.startTime.startsWith(today));
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
  
  return {
    todaySessions: todaySessions.length,
    todayMinutes,
    totalSessions,
    totalMinutes,
    currentStreak: 0,
    longestStreak: 0
  };
}

const SUPPORTED_THEMES = ['claude', 'pixel', 'fresh'];

function getTheme() {
  const database = readDatabase();
  return database.theme || 'claude';
}

function setTheme(theme) {
  if (!SUPPORTED_THEMES.includes(theme)) {
    throw new Error('Invalid theme: ' + theme + '. Supported: ' + SUPPORTED_THEMES.join(' / '));
  }
  const database = readDatabase();
  database.theme = theme;
  writeDatabase(database);
  return database;
}

function getAutoApproveTools() {
  const database = readDatabase();
  return Boolean(database.autoApproveTools);
}

function setAutoApproveTools(value) {
  const database = readDatabase();
  database.autoApproveTools = Boolean(value);
  writeDatabase(database);
  return database.autoApproveTools;
}

function listProviders() {
  const db = readDatabase();
  return { providers: db.llmProviders, activeId: db.activeLlmProviderId };
}

function addProvider(input = {}) {
  const name = normalizeText(input.name);
  const kind = input.kind;
  const baseUrl = normalizeText(input.baseUrl);
  const model = normalizeText(input.model);

  if (!name) {
    throw new Error('Provider name is required');
  }

  if (!['openai-compat', 'anthropic'].includes(kind)) {
    throw new Error('Invalid provider kind');
  }

  if (!baseUrl) {
    throw new Error('Provider baseUrl is required');
  }

  if (!model) {
    throw new Error('Provider model is required');
  }

  if (typeof input.supportsToolUse !== 'boolean') {
    throw new Error('Provider supportsToolUse is required');
  }

  const db = readDatabase();
  const timestamp = new Date().toISOString();
  const provider = {
    id: createId(),
    name,
    kind,
    baseUrl,
    model,
    temperature: Number.isFinite(input.temperature) ? input.temperature : 0.3,
    supportsToolUse: input.supportsToolUse,
    trustForWrite: typeof input.trustForWrite === 'boolean' ? input.trustForWrite : false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const maxTokens = normalizeMaxTokens(input.maxTokens);
  if (maxTokens !== undefined) provider.maxTokens = maxTokens;

  db.llmProviders.push(provider);
  // If no provider is active yet, the new one becomes active automatically.
  // Adding a Provider and then having to "活动" it again is unintuitive UX.
  if (!db.activeLlmProviderId) {
    db.activeLlmProviderId = provider.id;
  }
  writeDatabase(db);
  return provider;
}

function updateProvider(id, patch = {}) {
  const db = readDatabase();
  const provider = db.llmProviders.find((item) => item.id === id);

  if (!provider) {
    throw new Error('Provider not found');
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
    provider.name = normalizeText(patch.name);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'kind')) {
    if (!['openai-compat', 'anthropic'].includes(patch.kind)) {
      throw new Error('Invalid provider kind');
    }

    provider.kind = patch.kind;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'baseUrl')) {
    provider.baseUrl = normalizeText(patch.baseUrl);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'model')) {
    provider.model = normalizeText(patch.model);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'temperature')) {
    provider.temperature = patch.temperature;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'maxTokens')) {
    const maxTokens = normalizeMaxTokens(patch.maxTokens);
    if (maxTokens === undefined) delete provider.maxTokens;
    else provider.maxTokens = maxTokens;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'supportsToolUse')) {
    provider.supportsToolUse = patch.supportsToolUse;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'trustForWrite')) {
    provider.trustForWrite = patch.trustForWrite;
  }

  provider.updatedAt = new Date().toISOString();
  writeDatabase(db);
  return provider;
}

function deleteProvider(id) {
  const db = readDatabase();
  db.llmProviders = db.llmProviders.filter((provider) => provider.id !== id);

  if (db.activeLlmProviderId === id) {
    db.activeLlmProviderId = null;
  }

  writeDatabase(db);
}

function setActiveProvider(id) {
  const db = readDatabase();

  if (!db.llmProviders.some((provider) => provider.id === id)) {
    throw new Error('Provider not found');
  }

  db.activeLlmProviderId = id;
  writeDatabase(db);
}

function listWritingScenarios() {
  const db = readDatabase();
  return db.writingScenarios;
}

function addWritingScenario(input = {}) {
  const db = readDatabase();
  const scenario = {
    id: createId(),
    builtin: false,
    enabled: true,
    ...input,
  };

  db.writingScenarios.push(scenario);
  writeDatabase(db);
  return scenario;
}

function updateWritingScenario(id, patch = {}) {
  const db = readDatabase();
  const scenario = db.writingScenarios.find((item) => item.id === id);

  if (!scenario) {
    throw new Error('Writing scenario not found');
  }

  if (scenario.builtin) {
    if (Object.prototype.hasOwnProperty.call(patch, 'systemPromptAddon')) {
      scenario.systemPromptAddon = patch.systemPromptAddon;
    }
  } else {
    Object.assign(scenario, patch);
  }

  writeDatabase(db);
  return scenario;
}

function deleteWritingScenario(id) {
  const db = readDatabase();
  const scenario = db.writingScenarios.find((item) => item.id === id);

  if (!scenario) {
    throw new Error('Writing scenario not found');
  }

  if (scenario.builtin) {
    throw new Error('Cannot delete builtin scenario');
  }

  db.writingScenarios = db.writingScenarios.filter((item) => item.id !== id);
  writeDatabase(db);
  return db.writingScenarios;
}

function resetWritingScenarioToDefault(id) {
  const db = readDatabase();
  const index = db.writingScenarios.findIndex((item) => item.id === id);

  if (index < 0) {
    throw new Error('Writing scenario not found');
  }

  if (!db.writingScenarios[index].builtin) {
    throw new Error('Cannot reset non-builtin scenario');
  }

  let original = null;
  try {
    const { BUILTIN_SCENARIOS } = require('./writingScenarios.cjs');
    original = Array.isArray(BUILTIN_SCENARIOS)
      ? BUILTIN_SCENARIOS.find((scenario) => scenario.id === id)
      : null;
  } catch {
    original = null;
  }

  if (!original) {
    throw new Error('Builtin scenario default not found');
  }

  db.writingScenarios[index] = { ...original };
  writeDatabase(db);
  return db.writingScenarios[index];
}

function getItalicGuide() {
  const db = readDatabase();
  return db.italicGuide;
}

function setItalicGuide(config = {}) {
  const db = readDatabase();
  const next = { ...db.italicGuide };

  if (Object.prototype.hasOwnProperty.call(config, 'prompt')) {
    next.prompt = config.prompt;
  }

  if (Object.prototype.hasOwnProperty.call(config, 'enabled')) {
    next.enabled = config.enabled;
  }

  db.italicGuide = normalizeItalicGuide(next);
  writeDatabase(db);
  return db.italicGuide;
}

function getCustomVocab() {
  const db = readDatabase();
  return db.customVocab || normalizeCustomVocab();
}

function addCustomVocabWord(word) {
  if (typeof word !== 'string' || !word.trim()) {
    throw new Error('addCustomVocabWord: word must be a non-empty string');
  }
  const trimmed = word.trim();
  if (trimmed.length > 60) throw new Error('Word too long (>60 chars).');
  const db = readDatabase();
  const current = db.customVocab || normalizeCustomVocab();
  const lc = trimmed.toLowerCase();
  if (current.words.some((w) => w.toLowerCase() === lc)) {
    return current; // idempotent: already there
  }
  const next = { ...current, words: [...current.words, trimmed] };
  db.customVocab = normalizeCustomVocab(next);
  writeDatabase(db);
  return db.customVocab;
}

function removeCustomVocabWord(word) {
  if (typeof word !== 'string' || !word.trim()) {
    throw new Error('removeCustomVocabWord: word must be a non-empty string');
  }
  const lc = word.trim().toLowerCase();
  const db = readDatabase();
  const current = db.customVocab || normalizeCustomVocab();
  const next = {
    ...current,
    words: current.words.filter((w) => w.toLowerCase() !== lc),
  };
  db.customVocab = normalizeCustomVocab(next);
  writeDatabase(db);
  return db.customVocab;
}

function addCustomVocabPhrase(entry = {}) {
  const trigger = typeof entry.trigger === 'string' ? entry.trigger.trim() : '';
  const text = typeof entry.text === 'string' ? entry.text.trim() : '';
  const label = typeof entry.label === 'string' ? entry.label.trim() : undefined;
  if (!trigger) throw new Error('addCustomVocabPhrase: trigger is required');
  if (!text) throw new Error('addCustomVocabPhrase: text is required');
  if (trigger.length > 30) throw new Error('Trigger too long (>30 chars).');
  if (text.length > 160) throw new Error('Phrase too long (>160 chars).');
  const db = readDatabase();
  const current = db.customVocab || normalizeCustomVocab();
  const key = trigger.toLowerCase() + '|' + text.toLowerCase();
  const exists = current.phrases.some(
    (p) => (p.trigger.toLowerCase() + '|' + p.text.toLowerCase()) === key,
  );
  if (exists) return current; // idempotent
  const phrase = label ? { trigger, text, label } : { trigger, text };
  const next = { ...current, phrases: [...current.phrases, phrase] };
  db.customVocab = normalizeCustomVocab(next);
  writeDatabase(db);
  return db.customVocab;
}

function removeCustomVocabPhrase(trigger, text) {
  if (typeof trigger !== 'string' || !trigger.trim()) {
    throw new Error('removeCustomVocabPhrase: trigger is required');
  }
  const tLc = trigger.trim().toLowerCase();
  const xLc = typeof text === 'string' ? text.trim().toLowerCase() : null;
  const db = readDatabase();
  const current = db.customVocab || normalizeCustomVocab();
  const next = {
    ...current,
    phrases: current.phrases.filter((p) => {
      if (p.trigger.toLowerCase() !== tLc) return true;
      if (xLc !== null && p.text.toLowerCase() !== xLc) return true;
      return false;
    }),
  };
  db.customVocab = normalizeCustomVocab(next);
  writeDatabase(db);
  return db.customVocab;
}

function getUserProfile() {
  const db = readDatabase();
  return db.userProfile || normalizeUserProfile();
}

function setUserProfile(patch = {}) {
  const db = readDatabase();
  const current = db.userProfile || normalizeUserProfile();
  const next = { ...current, ...patch };
  db.userProfile = normalizeUserProfile(next);
  writeDatabase(db);
  return db.userProfile;
}

function clearCustomVocab() {
  const db = readDatabase();
  db.customVocab = normalizeCustomVocab();
  writeDatabase(db);
  return db.customVocab;
}

// Vocab pack registry
const { BUILTIN_PACK_META } = require('./vocabPackRegistry.cjs');

function listVocabPacks() {
  const db = readDatabase();
  const prefs = db.vocabPackPrefs || {};
  const customPacks = db.customVocabPacks || [];
  const out = [];
  for (const meta of BUILTIN_PACK_META) {
    const enabled = Object.prototype.hasOwnProperty.call(prefs, meta.id) ? !!prefs[meta.id] : !!meta.defaultEnabled;
    out.push({
      id: meta.id,
      name: meta.name,
      description: meta.description,
      builtin: true,
      defaultEnabled: !!meta.defaultEnabled,
      enabled,
    });
  }
  for (const pack of customPacks) {
    const enabled = Object.prototype.hasOwnProperty.call(prefs, pack.id) ? !!prefs[pack.id] : !!pack.defaultEnabled;
    out.push({
      id: pack.id,
      name: pack.name,
      description: pack.description || '',
      builtin: false,
      defaultEnabled: !!pack.defaultEnabled,
      enabled,
    });
  }
  return out;
}

function setVocabPackEnabled(id, enabled) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('setVocabPackEnabled: id is required');
  }
  if (typeof enabled !== 'boolean') {
    throw new Error('setVocabPackEnabled: enabled must be boolean');
  }
  const db = readDatabase();
  const knownIds = new Set(BUILTIN_PACK_IDS);
  for (const pack of (db.customVocabPacks || [])) knownIds.add(pack.id);
  if (!knownIds.has(id)) {
    throw new Error('setVocabPackEnabled: unknown pack id ' + id);
  }
  const next = { ...(db.vocabPackPrefs || {}), [id]: enabled };
  db.vocabPackPrefs = normalizeVocabPackPrefs(next);
  writeDatabase(db);
  return listVocabPacks();
}

function importVocabPack(payload = {}) {
  const pack = normalizeImportedVocabPack(payload);
  const totalWords = Object.values(pack.words || {}).reduce((n, arr) => n + arr.length, 0);
  const totalPhrases = Object.values(pack.phrases || {}).reduce((n, arr) => n + arr.length, 0);
  if (totalWords === 0 && totalPhrases === 0) {
    throw new Error('importVocabPack: pack contains no words or phrases');
  }
  const db = readDatabase();
  const existing = (db.customVocabPacks || []).filter((p) => p.id !== pack.id);
  existing.push(pack);
  db.customVocabPacks = normalizeCustomVocabPacks(existing);
  writeDatabase(db);
  return pack;
}

function deleteCustomVocabPack(id) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('deleteCustomVocabPack: id is required');
  }
  if (BUILTIN_PACK_IDS.includes(id)) {
    throw new Error('Cannot delete a built-in pack');
  }
  const db = readDatabase();
  const before = (db.customVocabPacks || []).length;
  db.customVocabPacks = (db.customVocabPacks || []).filter((p) => p.id !== id);
  if (db.customVocabPacks.length === before) {
    throw new Error('deleteCustomVocabPack: pack not found');
  }
  if (db.vocabPackPrefs && Object.prototype.hasOwnProperty.call(db.vocabPackPrefs, id)) {
    const next = { ...db.vocabPackPrefs };
    delete next[id];
    db.vocabPackPrefs = next;
  }
  writeDatabase(db);
  return listVocabPacks();
}

function renameCustomVocabPack(id, name) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('renameCustomVocabPack: id is required');
  }
  if (BUILTIN_PACK_IDS.includes(id)) {
    throw new Error('Cannot rename a built-in pack');
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('renameCustomVocabPack: name is required');
  }
  const trimmed = name.trim().slice(0, 60);
  const db = readDatabase();
  const packs = (db.customVocabPacks || []).slice();
  const idx = packs.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('renameCustomVocabPack: pack not found');
  packs[idx] = { ...packs[idx], name: trimmed };
  db.customVocabPacks = packs;
  writeDatabase(db);
  return packs[idx];
}

function getCustomVocabPacks() {
  const db = readDatabase();
  return (db.customVocabPacks || []).slice();
}

function getZoteroConfig() {
  const db = readDatabase();
  return db.zoteroConfig;
}

function setZoteroConfig(config = {}) {
  const db = readDatabase();
  const next = { ...db.zoteroConfig };

  if (Object.prototype.hasOwnProperty.call(config, 'endpoint')) {
    next.endpoint = config.endpoint;
  }

  if (Object.prototype.hasOwnProperty.call(config, 'userId')) {
    next.userId = config.userId;
  }

  if (Object.prototype.hasOwnProperty.call(config, 'enabled')) {
    next.enabled = config.enabled;
  }

  db.zoteroConfig = normalizeZoteroConfig(next);
  writeDatabase(db);
  return db.zoteroConfig;
}

function getWritingStats() {
  const database = readDatabase();
  const articles = database.articles || [];
  
  let totalWords = 0;
  let totalChars = 0;
  const wordFrequency = {};
  const sectionStats = {};
  
  articles.forEach(article => {
    article.sections.forEach(section => {
      section.contentBlocks.forEach(block => {
        if (block.type === 'Text') {
          const words = block.content.split(/\s+/).filter(w => w.length > 0);
          const blockWords = countWords(block.content);
          totalWords += blockWords;
          totalChars += block.content.length;
          
          words.forEach(word => {
            const lower = word.toLowerCase();
            wordFrequency[lower] = (wordFrequency[lower] || 0) + 1;
          });
          
          const sectionType = section.type;
          sectionStats[sectionType] = (sectionStats[sectionType] || 0) + blockWords;
        }
      });
    });
  });
  
  const mostUsedWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));
  
  const topSections = Object.entries(sectionStats)
    .sort((a, b) => b[1] - a[1])
    .map(([section, words]) => ({ section, words }));
  
  return {
    totalArticles: articles.length,
    totalWords,
    totalChars,
    averageWordsPerArticle: articles.length > 0 ? Math.round(totalWords / articles.length) : 0,
    mostUsedWords,
    sentenceLengthDistribution: [],
    writingFrequency: [],
    topSections
  };
}

function addTag(articleId, tagName, tagColor) {
  const database = readDatabase();
  const article = database.articles.find(a => a.id === articleId);
  
  if (!article) {
    throw new Error('Article not found');
  }
  
  if (!article.tags) {
    article.tags = [];
  }
  
  const existingTag = article.tags.find(t => t.name === tagName);
  if (existingTag) {
    return article.tags;
  }
  
  article.tags.push({
    id: createId(),
    name: tagName,
    color: tagColor || '#a56f4f',
    createdAt: now()
  });
  
  writeDatabase(database);
  return article.tags;
}

function removeTag(articleId, tagId) {
  const database = readDatabase();
  const article = database.articles.find(a => a.id === articleId);
  
  if (!article) {
    throw new Error('Article not found');
  }
  
  if (!article.tags) {
    article.tags = [];
  }
  
  article.tags = article.tags.filter(t => t.id !== tagId);
  writeDatabase(database);
  return article.tags;
}

function loadState() {
  const database = readDatabase();

  return {
    baseDirectory: BASE_DIRECTORY,
    articles: [...database.articles]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(enrichArticle),
    theses: [...database.theses]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    writingStreak: database.writingStreak,
    pomodoroStats: getPomodoroStats(),
    theme: database.theme || 'light',
    progressEntries: Array.isArray(database.progressEntries) ? database.progressEntries : [],
    dailySessions: Array.isArray(database.dailySessions) ? database.dailySessions : [],
    userProfile: database.userProfile || { displayName: '' },
  };
}

function updateArticleMeta(articleId, patch) {
  const database = readDatabase();
  const article = findArticle(database, articleId);

  article.title = normalizeText(patch.title) || article.title;
  article.targetJournal = normalizeText(patch.targetJournal);
  article.status = ARTICLE_STATUSES.includes(patch.status) ? patch.status : article.status;
  touchArticle(article);

  writeDatabase(database);
}

function updateResearchContext(articleId, researchContext) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const incoming = researchContext || {};

  // 部分字段更新：缺字段保持原值（早期实现把 undefined → 空串覆盖，
  // 导致 LLM 调一次 update_research_context 就清掉 3 个未传字段）。
  const validKeys = ['scientificQuestion', 'observedPhenomenon', 'hypothesis', 'approach'];
  const merged = { ...article.researchContext };
  let touched = 0;
  for (const key of validKeys) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      merged[key] = normalizeText(incoming[key]);
      touched += 1;
    }
  }
  if (touched === 0) {
    // 没命中任何已知字段：可能调用方用了过时 schema (background/objectives/
    // keyMethods)，必须报错而非静默 no-op，否则 AI 自以为成功了。
    const got = Object.keys(incoming).join(', ') || '(空)';
    throw new Error(
      `updateResearchContext: 未识别任何字段（收到：${got}）。当前 schema 仅接受 ${validKeys.join(' / ')}。`,
    );
  }
  merged.updatedAt = now();

  article.researchContext = merged;
  touchArticle(article);

  writeDatabase(database);
}

function addTextBlock(articleId, sectionType, content, description = '', modifiedBy = 'SciPaper Todo', source = 'manual') {
  const cleanContent = normalizeText(content);

  if (!cleanContent) {
    throw new Error('Text content cannot be empty');
  }

  const database = readDatabase();
  const article = findArticle(database, articleId);
  const section = findSection(article, sectionType);
  const timestamp = now();

  section.contentBlocks.push({
    id: createId(),
    sectionId: section.id,
    type: 'Text',
    content: cleanContent,
    description: normalizeText(description),
    orderIndex: section.contentBlocks.length,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: modifiedBy,
    updatedBy: modifiedBy,
    versions: [createTextVersion(cleanContent, modifiedBy, '创建文本块')],
  });

  touchArticle(article);
  writeDatabase(database);
}

function updateSectionContent(
  articleId,
  sectionType,
  content,
  mode = 'append',
  description = '',
  modifiedBy = 'SciPaper Todo',
  source = 'manual',
) {
  const cleanContent = normalizeText(content);

  if (!cleanContent) {
    throw new Error('Section content cannot be empty');
  }

  const database = readDatabase();
  const article = findArticle(database, articleId);
  const section = findSection(article, sectionType);
  const timestamp = now();

  if (mode === 'replace') {
    const oldJoined = section.contentBlocks
      .filter((block) => normalizeBlockType(block.type) === 'Text')
      .map((block) => block.content || '')
      .join('\n\n');
    const nonTextBlocks = section.contentBlocks.filter((block) => normalizeBlockType(block.type) !== 'Text');

    section.contentBlocks = [
      {
        id: createId(),
        sectionId: section.id,
        type: 'Text',
        content: cleanContent,
        description: normalizeText(description) || '整节替换',
        orderIndex: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: modifiedBy,
        updatedBy: modifiedBy,
        versions: [createTextVersion(cleanContent, modifiedBy, description || '替换章节内容')],
      },
      ...nonTextBlocks,
    ].map((block, orderIndex) => ({
      ...block,
      orderIndex,
    }));
    const diff = diffWords(oldJoined, cleanContent);
    database.writingStreak = applyWritingStreak(database.writingStreak, {
      added: diff.addedChars,
      removed: diff.removedChars,
      source: source || 'manual',
    });
  } else {
    section.contentBlocks.push({
      id: createId(),
      sectionId: section.id,
      type: 'Text',
      content: cleanContent,
      description: normalizeText(description),
      orderIndex: section.contentBlocks.length,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: modifiedBy,
      updatedBy: modifiedBy,
      versions: [createTextVersion(cleanContent, modifiedBy, description || '追加章节内容')],
    });
    database.writingStreak = applyWritingStreak(database.writingStreak, {
      added: countWords(cleanContent),
      removed: 0,
      source: source || 'manual',
    });
  }

  touchArticle(article);
  writeDatabase(database);
}

function updateTextBlock(articleId, blockId, content, description = '', modifiedBy = 'SciPaper Todo', source = 'manual') {
  const cleanContent = normalizeText(content);

  if (!cleanContent) {
    throw new Error('Text content cannot be empty');
  }

  const database = readDatabase();
  const article = findArticle(database, articleId);
  const { block } = findBlock(article, blockId);
  const oldContent = block.content;

  block.content = cleanContent;
  block.description = normalizeText(description);
  block.updatedAt = now();
  block.updatedBy = modifiedBy;

  const diff = diffWords(oldContent, cleanContent);
  database.writingStreak = applyWritingStreak(database.writingStreak, {
    added: diff.addedChars,
    removed: diff.removedChars,
    source: source || 'manual',
  });
  touchArticle(article);
  writeDatabase(database);
}

function importManuscriptSections(articleId, sections = [], mode = 'append') {
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('importManuscriptSections: sections cannot be empty');
  }

  const database = readDatabase();
  const article = findArticle(database, articleId);
  const timestamp = now();
  const batch = {
    id: createId(),
    articleId,
    kind: 'manuscript',
    sourceName: normalizeText(sections[0]?.sourceName),
    createdAt: timestamp,
    blockIds: [],
    commentIds: [],
    roundIds: [],
  };

  for (const item of sections) {
    const sectionType = item?.sectionType;
    const cleanContent = normalizeText(item?.content);
    if (!SECTION_TYPES.includes(sectionType) || !cleanContent) continue;

    const section = findSection(article, sectionType);
    const blockId = createId();
    if (mode === 'replace') {
      const nonTextBlocks = section.contentBlocks.filter((block) => normalizeBlockType(block.type) !== 'Text');
      section.contentBlocks = [
        {
          id: blockId,
          sectionId: section.id,
          type: 'Text',
          content: cleanContent,
          description: normalizeText(item.description) || 'Imported manuscript draft',
          orderIndex: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: 'Import Assistant',
          updatedBy: 'Import Assistant',
          versions: [createTextVersion(cleanContent, 'Import Assistant', '导入手稿正文')],
        },
        ...nonTextBlocks,
      ].map((block, orderIndex) => ({ ...block, orderIndex }));
    } else {
      section.contentBlocks.push({
        id: blockId,
        sectionId: section.id,
        type: 'Text',
        content: cleanContent,
        description: normalizeText(item.description) || 'Imported manuscript draft',
        orderIndex: section.contentBlocks.length,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'Import Assistant',
        updatedBy: 'Import Assistant',
        versions: [createTextVersion(cleanContent, 'Import Assistant', '导入手稿正文')],
      });
    }
    batch.blockIds.push(blockId);

    database.writingStreak = applyWritingStreak(database.writingStreak, {
      added: countWords(cleanContent),
      removed: 0,
      source: 'import',
    });
  }

  touchArticle(article);
  if (batch.blockIds.length > 0) {
    database.importBatches = database.importBatches || [];
    database.importBatches.unshift(batch);
  }
  writeDatabase(database);
}

const TOKEN_REGEX =
  /([\u4e00-\u9fa5])|([a-zA-Z]+(?:['-][a-zA-Z]+)*)|(\d+(?:\.\d+)?)|(\s+)|([^\s\u4e00-\u9fa5\w])/g;

function tokenizeWords(text) {
  const tokens = [];
  let match;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    if (match[4] === undefined) {
      tokens.push(match[0]);
    }
  }

  TOKEN_REGEX.lastIndex = 0;
  return tokens;
}

function tokenWeight(token) {
  if (
    /^[\u4e00-\u9fa5]$/.test(token) ||
    /^[a-zA-Z]+(?:['-][a-zA-Z]+)*$/.test(token) ||
    /^\d+(?:\.\d+)?$/.test(token)
  ) {
    return 1;
  }

  return 0;
}

function lcsCount(a, b) {
  const columns = a.length <= b.length ? a : b;
  const rows = a.length <= b.length ? b : a;
  let previous = new Array(columns.length + 1).fill(0);

  for (const rowToken of rows) {
    const current = new Array(columns.length + 1).fill(0);

    for (let columnIndex = 1; columnIndex <= columns.length; columnIndex += 1) {
      const columnToken = columns[columnIndex - 1];
      const skipRow = previous[columnIndex];
      const skipColumn = current[columnIndex - 1];

      if (rowToken === columnToken) {
        current[columnIndex] = Math.max(previous[columnIndex - 1] + tokenWeight(rowToken), skipRow, skipColumn);
      } else {
        current[columnIndex] = Math.max(skipRow, skipColumn);
      }
    }

    previous = current;
  }

  return previous[columns.length];
}

function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const cleaned = text.trim();
  if (!cleaned) {
    return 0;
  }

  const chineseChars = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = cleaned
    .replace(/[\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

  return chineseChars + englishWords;
}

function diffWords(oldText, newText) {
  const safeOldText = oldText ?? '';
  const safeNewText = newText ?? '';
  const oldCount = countWords(safeOldText);
  const newCount = countWords(safeNewText);

  if (safeOldText === safeNewText) {
    return {
      addedChars: 0,
      removedChars: 0,
      changedChars: 0,
      netChars: 0,
      oldCount,
      newCount,
    };
  }

  const oldTokens = tokenizeWords(safeOldText);
  const newTokens = tokenizeWords(safeNewText);
  let addedChars;
  let removedChars;

  if (oldTokens.length > 5000 || newTokens.length > 5000) {
    addedChars = Math.max(0, newCount - oldCount);
    removedChars = Math.max(0, oldCount - newCount);
  } else {
    const commonCount = lcsCount(oldTokens, newTokens);
    addedChars = Math.max(0, newCount - commonCount);
    removedChars = Math.max(0, oldCount - commonCount);
  }

  return {
    addedChars,
    removedChars,
    changedChars: addedChars + removedChars,
    netChars: newCount - oldCount,
    oldCount,
    newCount,
  };
}

const MAX_BLOCK_VERSIONS = 3;

function recordBlockVersion(articleId, blockId, changeDescription = '快照', modifiedBy = 'SciPaper Todo') {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const { block } = findBlock(article, blockId);
  if (block.type !== 'Text') {
    throw new Error('Only text blocks can have version snapshots');
  }
  block.versions = block.versions ?? [];
  const latest = block.versions[0];
  if (latest && latest.content === block.content) {
    return database;
  }
  block.versions.unshift(createTextVersion(block.content, modifiedBy, changeDescription));
  if (block.versions.length > MAX_BLOCK_VERSIONS) {
    block.versions = block.versions.slice(0, MAX_BLOCK_VERSIONS);
  }
  touchArticle(article);
  writeDatabase(database);
  return database;
}

function updateTextBlockWithStreak(articleId, blockId, content, description = '', modifiedBy = 'SciPaper Todo') {
  return updateTextBlock(articleId, blockId, content, description, modifiedBy, 'manual');
}

function addCitation(articleId, payload) {
  const database = readDatabase();
  const article = findArticle(database, articleId);

  article.citations.unshift({
    id: createId(),
    articleId,
    bibtex: normalizeText(payload.bibtex),
    title: normalizeText(payload.title),
    authors: normalizeText(payload.authors),
    year: normalizeText(payload.year),
    localPdfPath: normalizeText(payload.localPdfPath),
    sectionLinks: (payload.relevantSections ?? []).map((sectionType) => {
      const section = article.sections.find((item) => item.type === sectionType);

      return {
        citationId: createId(),
        sectionId: section?.id || '',
        context: '',
      };
    }),
  });

  touchArticle(article);
  writeDatabase(database);
}

function deleteBlock(articleId, blockId, source = 'manual') {
  const database = readDatabase();
  const article = findArticle(database, articleId);

  for (const section of article.sections) {
    const index = section.contentBlocks.findIndex((item) => item.id === blockId);

    if (index >= 0) {
      const block = section.contentBlocks[index];
      const oldContent = block.type === 'Text' ? (block.content || '') : '';
      section.contentBlocks.splice(index, 1);
      section.contentBlocks = section.contentBlocks.map((block, orderIndex) => ({
        ...block,
        orderIndex,
      }));
      if (oldContent) {
        database.writingStreak = applyWritingStreak(database.writingStreak, {
          added: 0,
          removed: countWords(oldContent),
          source: source || 'manual',
        });
      }
      touchArticle(article);
      writeDatabase(database);
      return;
    }
  }

  throw new Error('Content block not found');
}

// ---- Block annotations (sprint v2.2) -------------------------------------
// Annotations live on the block they reference. We persist:
//   { id, blockId, anchorText, comment, author, status, createdAt, updatedAt }
// anchorText is the verbatim quote — positions are recomputed in the renderer
// because text drifts as the user edits.

function findBlockAcrossSections(article, blockId) {
  for (const section of article.sections) {
    const block = section.contentBlocks.find((b) => b.id === blockId);
    if (block) return { section, block };
  }
  return { section: null, block: null };
}

function findBlockByAnnotationId(article, annotationId) {
  for (const section of article.sections) {
    for (const block of section.contentBlocks) {
      if (Array.isArray(block.annotations)) {
        const idx = block.annotations.findIndex((a) => a.id === annotationId);
        if (idx >= 0) return { section, block, annotationIndex: idx };
      }
    }
  }
  return { section: null, block: null, annotationIndex: -1 };
}

function addAnnotation(articleId, blockId, payload) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const { block } = findBlockAcrossSections(article, blockId);

  if (!block) throw new Error('Content block not found');
  if (block.type !== 'Text') throw new Error('Annotations are only supported on text blocks');

  const anchorText = String(payload && payload.anchorText ? payload.anchorText : '').trim();
  const comment = String(payload && payload.comment ? payload.comment : '').trim();
  if (!anchorText) throw new Error('anchorText is required');
  if (!comment) throw new Error('comment is required');

  const author = payload && payload.author === 'ai' ? 'ai' : 'user';
  const timestamp = now();
  const annotation = {
    id: createId(),
    blockId,
    anchorText,
    comment,
    author,
    status: 'open',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  if (!Array.isArray(block.annotations)) block.annotations = [];
  block.annotations.push(annotation);
  block.updatedAt = timestamp;
  touchArticle(article);
  writeDatabase(database);
}

function updateAnnotation(articleId, annotationId, patch) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const { block, annotationIndex } = findBlockByAnnotationId(article, annotationId);

  if (!block || annotationIndex < 0) throw new Error('Annotation not found');

  const annotation = block.annotations[annotationIndex];
  if (patch && typeof patch.comment === 'string') annotation.comment = patch.comment.trim();
  if (patch && (patch.status === 'open' || patch.status === 'resolved')) {
    annotation.status = patch.status;
  }
  annotation.updatedAt = now();
  block.updatedAt = annotation.updatedAt;
  touchArticle(article);
  writeDatabase(database);
}

function deleteAnnotation(articleId, annotationId) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const { block, annotationIndex } = findBlockByAnnotationId(article, annotationId);

  if (!block || annotationIndex < 0) throw new Error('Annotation not found');

  block.annotations.splice(annotationIndex, 1);
  block.updatedAt = now();
  touchArticle(article);
  writeDatabase(database);
}

function inferPreviewKind(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (IMAGE_EXTENSIONS.has(extension)) {
    return extension === '.tif' || extension === '.tiff' ? 'tiff' : 'image';
  }

  if (PDF_EXTENSIONS.has(extension)) {
    return 'pdf';
  }

  return 'none';
}

function addAssetBlock(articleId, sectionType, kind, sourcePath, modifiedBy = 'SciPaper Todo', customDescription = '') {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const section = findSection(article, sectionType);
  const timestamp = now();
  const originalName = path.basename(sourcePath);
  const articleRoot = createArticleFolder(articleId);
  const attachmentsDir = path.join(articleRoot, 'Attachments');
  const safeName = `${Date.now()}-${originalName.replace(/\s+/g, '-')}`;
  const destination = path.join(attachmentsDir, safeName);

  fs.copyFileSync(sourcePath, destination);

  const storedValue = path.join('Attachments', safeName);
  const fallbackDescription = kind === 'image' ? `图像附件 · ${originalName}` : `备份文件 · ${originalName}`;
  const description = normalizeText(customDescription) || fallbackDescription;
  const type = kind === 'image' ? 'Image' : 'FileLink';

  section.contentBlocks.push({
    id: createId(),
    sectionId: section.id,
    type,
    content: storedValue,
    description,
    orderIndex: section.contentBlocks.length,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: modifiedBy,
    updatedBy: modifiedBy,
    versions: [],
  });

  touchArticle(article);
  writeDatabase(database);
}

// === ProgressEntry / Finding / DailySession CRUD ===

function addProgressEntry(payload, createdBy = 'user') {
  const database = readDatabase();
  if (!payload || typeof payload !== 'object') throw new Error('Payload required');
  if (!payload.title) throw new Error('title is required');

  const article = payload.articleId ? findArticle(database, payload.articleId) : null;
  const today = localIsoDate();
  const entry = normalizeProgressEntry({
    id: createId(),
    date: payload.date || today,
    articleId: payload.articleId,
    kind: payload.kind,
    title: payload.title,
    detail: payload.detail,
    sectionId: payload.sectionId,
    findingId: payload.findingId,
    citationId: payload.citationId,
    minutesSpent: payload.minutesSpent,
    createdBy,
  });

  database.progressEntries = database.progressEntries || [];
  database.progressEntries.unshift(entry);

  // 自动挂到当天 session（如果存在）
  const session = (database.dailySessions || []).find((s) => s.date === entry.date);
  if (session && !session.progressEntryIds.includes(entry.id)) {
    session.progressEntryIds.unshift(entry.id);
  }

  if (article) touchArticle(article);
  writeDatabase(database);
  return entry;
}

function updateProgressEntry(entryId, patch) {
  const database = readDatabase();
  database.progressEntries = database.progressEntries || [];
  const idx = database.progressEntries.findIndex((e) => e.id === entryId);
  if (idx < 0) throw new Error('ProgressEntry not found');

  const existing = database.progressEntries[idx];
  const merged = normalizeProgressEntry({ ...existing, ...patch, id: existing.id });
  database.progressEntries[idx] = merged;
  writeDatabase(database);
  return merged;
}

function deleteProgressEntry(entryId) {
  const database = readDatabase();
  database.progressEntries = (database.progressEntries || []).filter((e) => e.id !== entryId);
  database.dailySessions = (database.dailySessions || []).map((s) => ({
    ...s,
    progressEntryIds: s.progressEntryIds.filter((id) => id !== entryId),
  }));
  writeDatabase(database);
}

function listProgressEntries(filter = {}) {
  const database = readDatabase();
  let entries = database.progressEntries || [];
  if (filter.articleId) entries = entries.filter((e) => e.articleId === filter.articleId);
  if (filter.date) entries = entries.filter((e) => e.date === filter.date);
  if (filter.dateFrom) entries = entries.filter((e) => e.date >= filter.dateFrom);
  if (filter.dateTo) entries = entries.filter((e) => e.date <= filter.dateTo);
  if (filter.kind) entries = entries.filter((e) => e.kind === filter.kind);
  if (filter.findingId) entries = entries.filter((e) => e.findingId === filter.findingId);
  return entries;
}

function linkProgressEntryToFinding(entryId, findingId) {
  return updateProgressEntry(entryId, { findingId });
}

function addFinding(articleId, sectionType, payload) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const section = findSection(article, sectionType);
  section.findings = Array.isArray(section.findings) ? section.findings : [];

  const finding = normalizeFinding({
    id: createId(),
    sectionId: section.id,
    title: payload.title,
    description: payload.description,
    status: payload.status || 'planned',
    orderIndex: section.findings.length,
  });

  section.findings.push(finding);
  touchArticle(article);
  writeDatabase(database);
  return finding;
}

function updateFinding(articleId, findingId, patch) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  let updated = null;
  for (const section of article.sections) {
    if (!Array.isArray(section.findings)) continue;
    const idx = section.findings.findIndex((f) => f.id === findingId);
    if (idx >= 0) {
      const merged = normalizeFinding({ ...section.findings[idx], ...patch, id: findingId, sectionId: section.id, updatedAt: now() });
      section.findings[idx] = merged;
      updated = merged;
      break;
    }
  }
  if (!updated) throw new Error('Finding not found');
  touchArticle(article);
  writeDatabase(database);
  return updated;
}

function deleteFinding(articleId, findingId) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  let removed = false;
  for (const section of article.sections) {
    if (!Array.isArray(section.findings)) continue;
    const before = section.findings.length;
    section.findings = section.findings.filter((f) => f.id !== findingId);
    if (section.findings.length < before) {
      section.findings = section.findings.map((f, i) => ({ ...f, orderIndex: i }));
      removed = true;
      break;
    }
  }
  if (!removed) throw new Error('Finding not found');

  // 解除 ProgressEntry 关联
  database.progressEntries = (database.progressEntries || []).map((e) =>
    e.findingId === findingId ? { ...e, findingId: undefined } : e,
  );

  touchArticle(article);
  writeDatabase(database);
}

function listFindings(articleId, sectionType) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  if (sectionType) {
    const section = (article.sections || []).find((s) => s.type === sectionType);
    return section?.findings || [];
  }
  return article.sections.flatMap((s) => (Array.isArray(s.findings) ? s.findings : []));
}

function startDailySession(date, planText = '') {
  const database = readDatabase();
  database.dailySessions = database.dailySessions || [];
  const targetDate = date || localIsoDate();
  const existing = database.dailySessions.find((s) => s.date === targetDate);
  if (existing) {
    if (planText) existing.planText = String(planText);
    writeDatabase(database);
    return existing;
  }
  const session = normalizeDailySession({
    date: targetDate,
    planText,
    startedAt: now(),
    progressEntryIds: [],
  });
  database.dailySessions.unshift(session);
  writeDatabase(database);
  return session;
}

function setDailyPlan(date, planText) {
  const database = readDatabase();
  database.dailySessions = database.dailySessions || [];
  const targetDate = date || localIsoDate();
  let session = database.dailySessions.find((s) => s.date === targetDate);
  if (!session) {
    session = normalizeDailySession({ date: targetDate, planText, startedAt: now(), progressEntryIds: [] });
    database.dailySessions.unshift(session);
  } else {
    session.planText = String(planText || '');
  }
  writeDatabase(database);
  return session;
}

function endDailySession(date, summaryText = '') {
  const database = readDatabase();
  database.dailySessions = database.dailySessions || [];
  const targetDate = date || localIsoDate();
  let session = database.dailySessions.find((s) => s.date === targetDate);
  if (!session) {
    session = normalizeDailySession({
      date: targetDate,
      startedAt: now(),
      progressEntryIds: [],
    });
    database.dailySessions.unshift(session);
  }
  session.endedAt = now();
  if (summaryText) session.summaryText = String(summaryText);
  writeDatabase(database);
  return session;
}

function getDailySession(date) {
  const database = readDatabase();
  const targetDate = date || localIsoDate();
  return (database.dailySessions || []).find((s) => s.date === targetDate) || null;
}

function addReviewRound(articleId, payload) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const nextRoundNumber =
    payload.roundNumber ||
    (article.reviewRounds.length > 0
      ? Math.max(...article.reviewRounds.map((round) => round.roundNumber)) + 1
      : 1);

  article.reviewRounds.unshift({
    id: createId(),
    articleId,
    roundNumber: nextRoundNumber,
    submittedAt: payload.submittedAt || localIsoDate(),
    journalName: normalizeText(payload.journalName) || article.targetJournal || '未填写',
    manuscriptNumber: normalizeText(payload.manuscriptNumber),
    reviewReceivedAt: payload.reviewReceivedAt || '',
    comments: [],
  });

  if (nextRoundNumber > 1) {
    article.status = 'Revision';
  }

  touchArticle(article);
  writeDatabase(database);
}

function addReviewComment(articleId, roundId, payload) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const round = article.reviewRounds.find((item) => item.id === roundId);

  if (!round) {
    throw new Error('Review round not found');
  }

  round.comments.unshift({
    id: createId(),
    reviewRoundId: roundId,
    reviewerId: normalizeText(payload.reviewerId) || `Reviewer ${round.comments.length + 1}`,
    originalText: normalizeText(payload.originalText),
    type: payload.type === 'Minor' ? 'Minor' : 'Major',
    suggestedSection: normalizeText(payload.suggestedSection),
    status: payload.status || 'Pending',
    revisions: [],
  });

  if (!round.reviewReceivedAt) {
    round.reviewReceivedAt = localIsoDate();
  }

  article.status = 'UnderReview';
  touchArticle(article);
  writeDatabase(database);
}

function importReviewComments(articleId, payload = {}) {
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  if (groups.length === 0) {
    throw new Error('importReviewComments: groups cannot be empty');
  }

  const database = readDatabase();
  const article = findArticle(database, articleId);
  let round = payload.roundId ? article.reviewRounds.find((item) => item.id === payload.roundId) : null;
  const batch = {
    id: createId(),
    articleId,
    kind: 'review',
    sourceName: normalizeText(payload.sourceName),
    createdAt: now(),
    blockIds: [],
    commentIds: [],
    roundIds: [],
  };

  if (!round) {
    const nextRoundNumber =
      payload.roundNumber ||
      (article.reviewRounds.length > 0
        ? Math.max(...article.reviewRounds.map((item) => item.roundNumber)) + 1
        : 1);
    round = {
      id: createId(),
      articleId,
      roundNumber: nextRoundNumber,
      submittedAt: payload.submittedAt || localIsoDate(),
      journalName: normalizeText(payload.journalName) || article.targetJournal || '未填写',
      manuscriptNumber: normalizeText(payload.manuscriptNumber),
      reviewReceivedAt: payload.reviewReceivedAt || localIsoDate(),
      comments: [],
    };
    article.reviewRounds.unshift(round);
    batch.roundIds.push(round.id);
  }

  for (const group of groups) {
    const reviewerId = normalizeText(group?.reviewerId) || `Reviewer ${round.comments.length + 1}`;
    const comments = Array.isArray(group?.comments) ? group.comments : [];
    for (const comment of comments) {
      const originalText = normalizeText(comment?.originalText);
      if (!originalText) continue;
      const commentId = createId();
      round.comments.push({
        id: commentId,
        reviewRoundId: round.id,
        reviewerId,
        originalText,
        type: comment?.type === 'Minor' ? 'Minor' : 'Major',
        suggestedSection: normalizeText(comment?.suggestedSection),
        status: comment?.status || 'Pending',
        revisions: [],
      });
      batch.commentIds.push(commentId);
    }
  }

  if (!round.reviewReceivedAt) {
    round.reviewReceivedAt = localIsoDate();
  }
  article.status = 'UnderReview';
  touchArticle(article);
  if (batch.commentIds.length > 0) {
    database.importBatches = database.importBatches || [];
    database.importBatches.unshift(batch);
  }
  writeDatabase(database);
}

function undoLastImportBatch(articleId) {
  const database = readDatabase();
  database.importBatches = database.importBatches || [];
  const batchIndex = database.importBatches.findIndex((batch) => !articleId || batch.articleId === articleId);
  if (batchIndex < 0) {
    throw new Error('没有可撤销的导入批次');
  }
  const batch = database.importBatches[batchIndex];
  const article = findArticle(database, batch.articleId);
  const blockIds = new Set(batch.blockIds || []);
  const commentIds = new Set(batch.commentIds || []);
  const roundIds = new Set(batch.roundIds || []);

  for (const section of article.sections || []) {
    const before = section.contentBlocks.length;
    section.contentBlocks = section.contentBlocks
      .filter((block) => !blockIds.has(block.id))
      .map((block, orderIndex) => ({ ...block, orderIndex }));
    if (section.contentBlocks.length !== before) {
      section.updatedAt = now();
    }
  }

  for (const round of article.reviewRounds || []) {
    round.comments = (round.comments || []).filter((comment) => !commentIds.has(comment.id));
  }
  article.reviewRounds = (article.reviewRounds || []).filter((round) => {
    return !(roundIds.has(round.id) && (!round.comments || round.comments.length === 0));
  });

  database.importBatches.splice(batchIndex, 1);
  touchArticle(article);
  writeDatabase(database);
}

function updateReviewCommentStatus(articleId, roundId, commentId, status) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const round = article.reviewRounds.find((item) => item.id === roundId);
  const comment = round?.comments.find((item) => item.id === commentId);

  if (!comment) {
    throw new Error('Review comment not found');
  }

  comment.status = status;
  touchArticle(article);
  writeDatabase(database);
}

function addRevision(articleId, roundId, commentId, payload) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const round = article.reviewRounds.find((item) => item.id === roundId);
  const comment = round?.comments.find((item) => item.id === commentId);

  if (!comment) {
    throw new Error('Review comment not found');
  }

  comment.revisions.unshift({
    id: createId(),
    reviewCommentId: commentId,
    description: normalizeText(payload.description),
    responseText: normalizeText(payload.responseText),
    modifiedBlockIds: payload.modifiedBlockIds ?? [],
    completedAt: now(),
    isVerified: Boolean(payload.isVerified),
  });
  comment.status = payload.markCompleted ? 'Completed' : comment.status;
  article.status = payload.markCompleted ? 'Revision' : article.status;
  touchArticle(article);

  writeDatabase(database);
}

function exportMarkdown(articleId) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const articleRoot = createArticleFolder(articleId);
  const exportDir = path.join(articleRoot, 'Exports');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const sectionTitles = {
    Title: '# 标题',
    Abstract: '## 摘要',
    Introduction: '## 前言',
    MaterialsAndMethods: '## 材料与方法',
    Results: '## 结果',
    Discussion: '## 讨论',
    References: '## 参考文献',
  };

  const markdown = [
    `# ${article.title}`,
    '',
    `- 目标期刊: ${article.targetJournal || '未填写'}`,
    `- 状态: ${article.status}`,
    '',
    '## 研究上下文',
    '',
    `- 科学问题: ${article.researchContext.scientificQuestion || '未填写'}`,
    `- 观察现象: ${article.researchContext.observedPhenomenon || '未填写'}`,
    `- 假设: ${article.researchContext.hypothesis || '未填写'}`,
    `- 方案: ${article.researchContext.approach || '未填写'}`,
    '',
    ...article.sections.flatMap((section) => {
      const lines = [sectionTitles[section.type], ''];

      if (section.contentBlocks.length === 0) {
        lines.push('_暂无内容_', '');
        return lines;
      }

      for (const block of section.contentBlocks.sort((left, right) => left.orderIndex - right.orderIndex)) {
        const blockType = normalizeBlockType(block.type);

        if (blockType === 'Text') {
          lines.push(block.content, '');
        } else if (blockType === 'Image') {
          const assetPath = resolveBlockPath(article.id, block);
          lines.push(`![${block.description || '图片'}](${assetPath})`, '');
        } else {
          const assetPath = resolveBlockPath(article.id, block);
          lines.push(`[${block.description || '文件'}](${assetPath})`, '');
        }
      }

      return lines;
    }),
  ].join('\n');

  const exportPath = path.join(exportDir, `${article.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '-') || 'manuscript'}-${stamp}.md`);
  fs.writeFileSync(exportPath, markdown, 'utf-8');
  return exportPath;
}

function openPathForBlock(articleId, blockId) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const { block } = findBlock(article, blockId);
  return resolveBlockPath(articleId, block);
}

function getPreviewPayload(articleId, blockId) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const { block } = findBlock(article, blockId);
  const assetError = getAssetPathError(block);
  if (assetError) throw new Error(assetError);
  const resolvedPath = resolveBlockPath(articleId, block);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error('Preview file not found');
  }

  return {
    path: resolvedPath,
    previewKind: inferPreviewKind(resolvedPath),
    fileName: path.basename(resolvedPath),
    extension: path.extname(resolvedPath).toLowerCase(),
  };
}

function getPendingReviewsCount(article) {
  return article.reviewRounds.reduce(
    (count, round) => count + round.comments.filter((comment) => comment.status !== 'Completed').length,
    0,
  );
}

function getWritingGuidance(articleId, targetSection) {
  const database = readDatabase();
  const article = findArticle(database, articleId);
  const context = article.researchContext;
  const hints = {
    Title: [
      `把科学问题“${context.scientificQuestion || '研究问题'}”压缩成一句可投稿的标题。`,
      '优先体现变量关系、模型系统和主要发现，不要一开始就写结论式夸张表述。',
    ],
    Abstract: [
      '按背景、问题、方法、结果、结论五句结构起草。',
      `摘要里至少点到方法关键词：${context.approach || '核心实验方案'}`,
    ],
    Introduction: [
      `第一段先界定问题：${context.scientificQuestion || '当前研究问题'}`,
      `第二段承接现象：${context.observedPhenomenon || '关键观察现象'}`,
      `末段落到假设与研究目标：${context.hypothesis || '研究假设'}`,
    ],
    MaterialsAndMethods: [
      `把方案“${context.approach || '实验流程'}”拆成材料、处理、检测、统计四块。`,
      '先记录样本量、重复次数、统计方法，再补试剂和仪器型号。',
    ],
    Results: [
      '每个结果块只证明一个命题，先图后文。',
      `优先解释与假设“${context.hypothesis || '研究假设'}”直接相关的数据。`,
    ],
    Discussion: [
      '先回扣主要发现，再解释机制，再谈局限与下一步。',
      `把观察现象“${context.observedPhenomenon || '现象'}”与文献中的相近现象作对照。`,
    ],
    References: [
      '先补齐核心领域综述，再补最近三年最直接的机制研究。',
      '如果某个结论还没有文献支撑，先在这一节留空位，不要在正文里硬写。',
    ],
  };

  return hints[targetSection] || [];
}

function getMcpResourceOverview(article) {
  const sectionsCompletion = {};

  for (const section of article.sections) {
    const latestBlock = [...section.contentBlocks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

    sectionsCompletion[section.type] = {
      blockCount: section.contentBlocks.length,
      lastModified: latestBlock?.updatedAt || article.updatedAt,
    };
  }

  return {
    id: article.id,
    title: article.title,
    target_journal: article.targetJournal,
    status: article.status,
    research_context: {
      question: article.researchContext.scientificQuestion,
      phenomenon: article.researchContext.observedPhenomenon,
      hypothesis: article.researchContext.hypothesis,
      approach: article.researchContext.approach,
    },
    sections_completion: sectionsCompletion,
    active_review_round: article.reviewRounds[0]?.roundNumber ?? null,
    pending_comments_count: getPendingReviewsCount(article),
  };
}

function getArticleById(articleId) {
  const database = readDatabase();
  return findArticle(database, articleId);
}

function getSectionByArticle(articleId, sectionType) {
  const article = getArticleById(articleId);
  return findSection(article, sectionType);
}

function exportToHTML(articleId) {
  const database = readDatabase();
  const article = database.articles.find(a => a.id === articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  const articleRoot = path.join(ARTICLES_DIRECTORY, articleId);
  const exportDir = path.join(articleRoot, 'Exports');
  fs.mkdirSync(exportDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(article.title)}</title>
  <style>
    body { font-family: 'Songti SC', 'SimSun', serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.8; }
    h1 { font-size: 24px; text-align: center; margin-bottom: 40px; }
    h2 { font-size: 18px; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
    p { margin: 16px 0; text-indent: 2em; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(article.title)}</h1>
  <div class="meta">
    <p>目标期刊: ${escapeHtml(article.targetJournal || '未填写')}</p>
    <p>状态: ${escapeHtml(article.status)}</p>
  </div>
`;

  article.sections.forEach(section => {
    const sectionTitle = {
      'Title': '标题',
      'Abstract': '摘要',
      'Introduction': '前言',
      'MaterialsAndMethods': '材料与方法',
      'Results': '结果',
      'Discussion': '讨论',
      'References': '参考文献'
    }[section.type] || section.type;

    html += `  <h2>${escapeHtml(sectionTitle)}</h2>\n`;

    section.contentBlocks.forEach(block => {
      if (block.type === 'Text') {
        html += `  <p>${escapeHtml(block.content)}</p>\n`;
      } else if (block.type === 'Image') {
        html += `  <p><img src="${escapeHtml(block.content)}" alt="${escapeHtml(block.description || '图片')}" style="max-width: 100%;"></p>\n`;
      }
    });
  });

  html += `</body>\n</html>`;

  const exportPath = path.join(exportDir, `${article.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '-') || 'manuscript'}-${stamp}.html`);
  fs.writeFileSync(exportPath, html, 'utf-8');

  return exportPath;
}

function exportToJSON(articleId) {
  const database = readDatabase();
  const article = database.articles.find(a => a.id === articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  const articleRoot = path.join(ARTICLES_DIRECTORY, articleId);
  const exportDir = path.join(articleRoot, 'Exports');
  fs.mkdirSync(exportDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exportPath = path.join(exportDir, `${article.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '-') || 'manuscript'}-${stamp}.json`);

  fs.writeFileSync(exportPath, JSON.stringify(article, null, 2), 'utf-8');

  return exportPath;
}

function createSharePackage(articleId) {
  const database = readDatabase();
  const article = database.articles.find(a => a.id === articleId);

  if (!article) {
    throw new Error('Article not found');
  }

  const articleRoot = path.join(ARTICLES_DIRECTORY, articleId);
  const exportDir = path.join(articleRoot, 'Exports');
  fs.mkdirSync(exportDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const shareDir = path.join(exportDir, `share-${stamp}`);
  fs.mkdirSync(shareDir, { recursive: true });

  fs.writeFileSync(
    path.join(shareDir, 'article.json'),
    JSON.stringify(article, null, 2),
    'utf-8'
  );

  const attachmentsDir = path.join(articleRoot, 'Attachments');
  if (fs.existsSync(attachmentsDir)) {
    const shareAttachmentsDir = path.join(shareDir, 'Attachments');
    fs.mkdirSync(shareAttachmentsDir, { recursive: true });

    fs.readdirSync(attachmentsDir).forEach(file => {
      fs.copyFileSync(
        path.join(attachmentsDir, file),
        path.join(shareAttachmentsDir, file)
      );
    });
  }

  fs.writeFileSync(
    path.join(shareDir, 'README.md'),
    `# ${article.title}\n\n导出时间: ${new Date().toLocaleString('zh-CN')}\n\n本目录包含论文数据和附件。`,
    'utf-8'
  );

  return shareDir;
}

module.exports = {
  SECTION_TYPES,
  ARTICLE_STATUSES,
  THESIS_STATUSES,
  THESIS_SECTION_TYPES,
  DEGREE_TYPES,
  BASE_DIRECTORY,
  THESES_DIRECTORY,
  DATABASE_PATH,
  createArticle,
  createThesis,
  loadState,
  updateArticleMeta,
  updateResearchContext,
  addTextBlock,
  updateSectionContent,
  importManuscriptSections,
  undoLastImportBatch,
  updateTextBlock,
  updateTextBlockWithStreak,
  recordBlockVersion,
  updateWritingStreak,
  countWords,
  addCitation,
  deleteBlock,
  addAssetBlock,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  addProgressEntry,
  updateProgressEntry,
  deleteProgressEntry,
  listProgressEntries,
  linkProgressEntryToFinding,
  addFinding,
  updateFinding,
  deleteFinding,
  listFindings,
  startDailySession,
  setDailyPlan,
  endDailySession,
  getDailySession,
  addReviewRound,
  addReviewComment,
  importReviewComments,
  updateReviewCommentStatus,
  addRevision,
  exportMarkdown,
  openPathForBlock,
  getPreviewPayload,
  getArticleDirectory,
  resolveBlockPath,
  getWritingGuidance,
  getArticleById,
  getSectionByArticle,
  getMcpResourceOverview,
  updateThesisMeta,
  addThesisSection,
  linkArticleToThesis,
  unlinkArticleFromThesis,
  deleteArticle,
  updateDailyGoal,
  addMoodEntry,
  getMoodHistory,
  addPomodoroSession,
  getPomodoroStats,
  getTheme,
  setTheme,
  listProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  setActiveProvider,
  listWritingScenarios,
  addWritingScenario,
  updateWritingScenario,
  deleteWritingScenario,
  resetWritingScenarioToDefault,
  getItalicGuide,
  setItalicGuide,
  getZoteroConfig,
  setZoteroConfig,
  getCustomVocab,
  addCustomVocabWord,
  removeCustomVocabWord,
  addCustomVocabPhrase,
  removeCustomVocabPhrase,
  clearCustomVocab,
  listVocabPacks,
  setVocabPackEnabled,
  importVocabPack,
  deleteCustomVocabPack,
  renameCustomVocabPack,
  getCustomVocabPacks,
  getUserProfile,
  setUserProfile,
  getWritingStats,
  addTag,
  removeTag,
  exportToHTML,
  exportToJSON,
  createSharePackage,
  SUPPORTED_THEMES,
  getAutoApproveTools,
  setAutoApproveTools,
};
