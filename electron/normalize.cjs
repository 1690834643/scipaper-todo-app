const path = require('path');
const { PRESETS } = require('./llmPresets.cjs');
const { localIsoDate } = require('./dateUtils.cjs');
const { DEFAULT_ITALIC_PROMPT } = require('./schema.cjs');

function now() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
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
        temperature: preset.temperature ?? 0,
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
    replacedSections: Array.isArray(batch.replacedSections)
      ? batch.replacedSections
        .filter((entry) => entry && typeof entry.sectionId === 'string' && Array.isArray(entry.contentBlocks))
        .map((entry) => ({
          sectionId: entry.sectionId,
          contentBlocks: entry.contentBlocks.map(normalizeStoredBlock),
        }))
      : [],
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

module.exports = {
  now,
  createId,
  normalizeText,
  normalizeBlockType,
  normalizeStoredBlock,
  normalizeStreakHistoryEntry,
  normalizeWritingStreak,
  normalizeMaxTokens,
  normalizeLlmProviders,
  normalizeWritingScenarios,
  normalizeItalicGuide,
  normalizeZoteroConfig,
  normalizeCustomVocab,
  normalizeImportedVocabPack,
  normalizeVocabPackPrefs,
  normalizeCustomVocabPacks,
  normalizeFinding,
  normalizeProgressEntry,
  normalizeDailySession,
  normalizeImportBatch,
  normalizeStoredDatabase,
  normalizeUserProfile,
  isWindowsAbsolutePath,
  normalizeRelativeAssetPath,
  warnWindowsImportPath,
  windowsPathToCurrentPlatform,
  getAssetPathError,
};
