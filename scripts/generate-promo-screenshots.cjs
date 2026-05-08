#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const screenshotDir = path.join(repoRoot, 'docs', 'screenshots');
const promoHome = path.join(os.tmpdir(), 'scipaper-promo-home');

process.env.HOME = promoHome;
process.env.USERPROFILE = promoHome;
process.env.ELECTRON_DISABLE_SANDBOX = '1';

const { app, BrowserWindow, ipcMain } = require('electron');
const storage = require(path.join(repoRoot, 'electron', 'storage.cjs'));
const { PRESETS } = require(path.join(repoRoot, 'electron', 'llmPresets.cjs'));
const { localIsoDate } = require(path.join(repoRoot, 'electron', 'dateUtils.cjs'));

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-zygote');
app.disableHardwareAcceleration();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localIsoDate(date);
}

function html(strings, ...values) {
  return strings.reduce((acc, part, index) => acc + part + (values[index] ?? ''), '');
}

function clearPromoHome() {
  fs.rmSync(promoHome, { recursive: true, force: true });
  fs.mkdirSync(promoHome, { recursive: true });
}

function seedDemoData() {
  clearPromoHome();

  const thesis = storage.createThesis({
    title: '水稻逆境记忆调控机制研究',
    titleEn: 'Stress memory programs in rice seedlings',
    author: 'K. S. Jie',
    supervisor: 'Prof. Lin',
    institution: 'Hunan Agricultural University',
    department: 'College of Life Sciences',
    degree: 'PhD',
    status: 'InProgress',
    abstractZh: '围绕水稻幼苗在重复干旱处理后的转录记忆、激素脉冲与根系恢复展开。',
    abstractEn: 'This thesis studies transcriptional memory and hormone pulse recovery in rice seedlings.',
    keywords: ['rice', 'stress memory', 'ABA', 'root recovery'],
  });

  const background = storage.createArticle({
    title: 'Chromatin priming predicts cold recovery in rice roots',
    targetJournal: 'Plant Physiology',
    status: 'UnderReview',
    language: 'en',
    researchContext: {
      scientificQuestion: 'Which chromatin marks preserve stress recovery capacity after cold pulses?',
      observedPhenomenon: 'Recovered roots show faster cell-cycle marker reactivation after the second pulse.',
      hypothesis: 'H3K4me3 retention at recovery genes creates a measurable priming window.',
      approach: 'Integrate ATAC-seq, time-course RNA-seq, and root imaging across two cold cycles.',
    },
  });

  const main = storage.createArticle({
    title: 'ABA pulse memory sharpens drought recovery in rice seedlings',
    targetJournal: 'Nature Plants',
    status: 'Revision',
    language: 'en',
    researchContext: {
      scientificQuestion: 'How does transient ABA signaling encode drought memory without locking seedlings into growth arrest?',
      observedPhenomenon: 'Recovered seedlings respond faster to a second dry-down while keeping root elongation intact.',
      hypothesis: 'A short ABA pulse leaves a reversible transcriptional trace at aquaporin and osmolyte loci.',
      approach: 'Combine pulse-chase hormone profiling, root-zone imaging, and section-level manuscript drafting.',
    },
  });

  const methods = storage.createArticle({
    title: 'Root-zone imaging workflow for repeated dry-down assays',
    targetJournal: 'Methods in Plant Biology',
    status: 'Drafting',
    language: 'en',
    researchContext: {
      scientificQuestion: 'Can the recovery assay be standardized enough for multi-lab comparison?',
      observedPhenomenon: 'Image variance drops when plates are aligned to root-zone landmarks.',
      hypothesis: 'A fixed imaging grid improves recovery-rate estimates across batches.',
      approach: 'Document sample preparation, imaging checkpoints, and normalization scripts.',
    },
  });

  storage.linkArticleToThesis(thesis.id, main.id);
  storage.linkArticleToThesis(thesis.id, background.id);
  storage.linkArticleToThesis(thesis.id, methods.id);

  storage.addTextBlock(main.id, 'Introduction', html`
    <h2>Stress memory without permanent arrest</h2>
    <p>Plants often retain a memory of previous drought, yet productive recovery requires that this memory remains reversible. We define ABA pulse memory as a short-lived regulatory state that accelerates later responses while preserving root growth.</p>
    <p>Here we combine hormone time courses, root-zone imaging, and transcript-level recovery metrics to separate useful priming from chronic stress damage.</p>
  `, 'Imported Markdown · Introduction');

  storage.addTextBlock(main.id, 'MaterialsAndMethods', html`
    <h2>Pulse-chase drought assay</h2>
    <p>Seedlings were exposed to a controlled dry-down for 6 h, re-watered for 24 h, and then challenged with a second pulse. Root elongation, ABA concentration, and marker gene expression were sampled at matched time points.</p>
  `, 'Methods block · assay design');

  storage.addTextBlock(main.id, 'Results', html`
    <h2>Recovered roots respond faster to the second pulse</h2>
    <p>The second dry-down induced aquaporin transcripts within 30 min, compared with 90 min in naive seedlings. The effect was strongest in the maturation zone and decayed after 72 h of recovery.</p>
    <p>Importantly, root elongation returned to baseline before the second challenge, indicating that the memory state did not require a persistent growth penalty.</p>
  `, 'Results block · recovery kinetics');

  storage.addTextBlock(main.id, 'Discussion', html`
    <h2>A reversible memory window</h2>
    <p>Our data support a model in which ABA pulse memory behaves like a temporary launch state: it shortens response latency, then clears before chronic arrest dominates. This distinction is useful for breeding programs that need resilience without sacrificing early vigor.</p>
  `, 'Discussion block · model');

  storage.addTextBlock(main.id, 'References', html`
    <p>Li et al. 2025. Hormone pulse memory in cereal roots. Plant Cell.</p>
    <p>Garcia and Patel 2024. Reversible chromatin states during dehydration recovery. New Phytologist.</p>
  `, 'Reference notes');

  storage.addTextBlock(background.id, 'Introduction', html`
    <p>Cold recovery creates a parallel model for reversible stress memory. This draft supplies the comparison frame for chromatin priming and root recovery.</p>
  `, 'Draft opening');

  storage.addTextBlock(methods.id, 'MaterialsAndMethods', html`
    <p>The imaging workflow aligns plates by root-zone landmarks, then exports a quality-control panel before segmentation.</p>
  `, 'Protocol draft');

  storage.addCitation(main.id, {
    title: 'Hormone pulse memory in cereal roots',
    authors: 'Li, Q.; Raman, S.; Chen, Y.',
    year: '2025',
    journal: 'Plant Cell',
    doi: '10.1093/plcell/pulse-memory',
    relevantSections: ['Introduction', 'Discussion'],
  });
  storage.addCitation(main.id, {
    title: 'Reversible chromatin states during dehydration recovery',
    authors: 'Garcia, M.; Patel, R.',
    year: '2024',
    journal: 'New Phytologist',
    doi: '10.1111/nph.2024.118',
    relevantSections: ['Results'],
  });
  storage.addTag(main.id, 'ABA pulse', '#1abc9c');
  storage.addTag(main.id, 'revision', '#e67e22');
  storage.addTag(main.id, 'root recovery', '#3498db');

  storage.addFinding(main.id, 'Results', {
    title: 'Second pulse shortens aquaporin response latency',
    description: 'Use Fig. 3C and the 30 min qPCR panel as the main result.',
    status: 'done',
  });
  storage.addFinding(main.id, 'Discussion', {
    title: 'Memory must clear before chronic arrest',
    description: 'Frame this as resilience without a growth penalty.',
    status: 'inProgress',
  });

  storage.addReviewRound(main.id, {
    roundNumber: 1,
    submittedAt: isoDaysAgo(21),
    journalName: 'Nature Plants',
    manuscriptNumber: 'NP-2026-0418',
    reviewReceivedAt: isoDaysAgo(5),
  });
  const round = storage.loadState().articles.find((article) => article.id === main.id).reviewRounds[0];
  storage.addReviewComment(main.id, round.id, {
    reviewerId: 'Reviewer 2',
    type: 'Major',
    suggestedSection: 'Results',
    status: 'InProgress',
    originalText: 'Please clarify whether faster ABA response reflects memory rather than residual dehydration.',
  });
  storage.addReviewComment(main.id, round.id, {
    reviewerId: 'Reviewer 1',
    type: 'Minor',
    suggestedSection: 'Discussion',
    status: 'Pending',
    originalText: 'Define the recovery window more explicitly in the model paragraph.',
  });

  storage.startDailySession(localIsoDate(), 'Finish the reviewer-response framing and replace the import screenshots.');
  storage.setDailyPlan(localIsoDate(), 'Rewrite Results transition, audit Markdown import, and prepare v1.0.49 release.');
  storage.addProgressEntry({
    date: isoDaysAgo(5),
    articleId: background.id,
    kind: 'read',
    title: 'Mapped cold recovery paper into chromatin comparison notes',
    minutesSpent: 35,
  });
  storage.addProgressEntry({
    date: isoDaysAgo(3),
    articleId: main.id,
    kind: 'analysis',
    title: 'Checked ABA pulse decay curve against root elongation data',
    minutesSpent: 50,
  });
  storage.addProgressEntry({
    date: isoDaysAgo(1),
    articleId: main.id,
    kind: 'writing',
    title: 'Drafted reversible memory paragraph for Discussion',
    detail: 'Kept the claim limited to the 72 h recovery window.',
    minutesSpent: 45,
  });
  storage.addProgressEntry({
    date: localIsoDate(),
    articleId: main.id,
    kind: 'writing',
    title: 'Merged Markdown import blocks into Results and Discussion',
    minutesSpent: 60,
  });
  storage.addMoodEntry('Motivated', 'Revision logic is finally narrow enough to defend.');
  storage.addPomodoroSession(25, main.id, 'Results');
  storage.addPomodoroSession(50, main.id, 'Discussion');
  storage.updateDailyGoal(1200);
  storage.updateWritingStreak({ added: 1380, source: 'manual' });
  storage.setUserProfile({ displayName: 'KSJ' });
  storage.setAutoApproveTools(true);
  storage.setTheme('claude');
}

function emitStateChanged() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('state:changed');
  }
}

function stateMutation(fn) {
  return async (...args) => {
    const result = await fn(...args);
    emitStateChanged();
    return result ?? storage.loadState();
  };
}

function registerIpc() {
  const mcpInfo = {
    command: 'node',
    args: [path.join(repoRoot, 'electron', 'mcp-cli.cjs')],
    baseDirectory: storage.BASE_DIRECTORY,
    configJson: JSON.stringify({ mcpServers: { 'scipaper-todo': { command: 'node', args: ['electron/mcp-cli.cjs'] } } }, null, 2),
    examples: {
      cursor: '',
      claudeCode: '',
    },
  };

  ipcMain.handle('app:bootstrap', async () => storage.loadState());
  ipcMain.handle('app:getMcpInfo', async () => mcpInfo);
  ipcMain.handle('data:openFolder', async () => storage.BASE_DIRECTORY);
  ipcMain.handle('data:exportBackup', async () => path.join(storage.BASE_DIRECTORY, 'backup.json'));
  ipcMain.handle('data:restoreBackup', stateMutation(async () => storage.loadState()));
  ipcMain.handle('article:create', stateMutation(async (_event, { payload }) => {
    storage.createArticle(payload);
    return storage.loadState();
  }));
  ipcMain.handle('article:delete', stateMutation(async (_event, { articleId }) => {
    storage.deleteArticle(articleId);
    return storage.loadState();
  }));
  ipcMain.handle('article:updateMeta', stateMutation(async (_event, { articleId, patch }) => {
    storage.updateArticleMeta(articleId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('article:updateResearchContext', stateMutation(async (_event, { articleId, researchContext }) => {
    storage.updateResearchContext(articleId, researchContext);
    return storage.loadState();
  }));
  ipcMain.handle('block:addText', stateMutation(async (_event, { articleId, sectionType, content, description }) => {
    storage.addTextBlock(articleId, sectionType, content, description);
    return storage.loadState();
  }));
  ipcMain.handle('block:updateText', stateMutation(async (_event, { articleId, blockId, content, description }) => {
    storage.updateTextBlock(articleId, blockId, content, description);
    return storage.loadState();
  }));
  ipcMain.handle('block:recordVersion', stateMutation(async (_event, { articleId, blockId, changeDescription }) => {
    storage.recordBlockVersion(articleId, blockId, changeDescription);
    return storage.loadState();
  }));
  ipcMain.handle('block:delete', stateMutation(async (_event, { articleId, blockId }) => {
    storage.deleteBlock(articleId, blockId);
    return storage.loadState();
  }));
  ipcMain.handle('annotation:add', stateMutation(async (_event, { articleId, blockId, payload }) => {
    storage.addAnnotation(articleId, blockId, payload);
    return storage.loadState();
  }));
  ipcMain.handle('annotation:update', stateMutation(async (_event, { articleId, annotationId, patch }) => {
    storage.updateAnnotation(articleId, annotationId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('annotation:delete', stateMutation(async (_event, { articleId, annotationId }) => {
    storage.deleteAnnotation(articleId, annotationId);
    return storage.loadState();
  }));
  ipcMain.handle('llm:keyStoreInfo', async () => ({ available: false, backend: 'promo' }));
  ipcMain.handle('block:importAsset', async () => storage.loadState());
  ipcMain.handle('import:selectTextFile', async () => null);
  ipcMain.handle('import:selectTextFiles', async () => []);
  ipcMain.handle('import:manuscriptSections', stateMutation(async (_event, { articleId, sections, mode }) => {
    storage.importManuscriptSections(articleId, sections, mode);
    return storage.loadState();
  }));
  ipcMain.handle('import:reviewComments', stateMutation(async (_event, { articleId, payload }) => {
    storage.importReviewComments(articleId, payload);
    return storage.loadState();
  }));
  ipcMain.handle('import:undoLast', stateMutation(async (_event, { articleId }) => {
    storage.undoLastImportBatch(articleId);
    return storage.loadState();
  }));
  ipcMain.handle('import:reformatText', async (_event, { text }) => ({ text, sections: [] }));
  ipcMain.handle('block:openAsset', async () => null);
  ipcMain.handle('block:getPreview', async () => null);
  ipcMain.handle('article:openFolder', async (_event, { articleId }) => storage.getArticleDirectory(articleId));
  ipcMain.handle('review:addRound', stateMutation(async (_event, { articleId, payload }) => {
    storage.addReviewRound(articleId, payload);
    return storage.loadState();
  }));
  ipcMain.handle('review:updateRound', stateMutation(async (_event, { articleId, roundId, patch }) => {
    storage.updateReviewRound(articleId, roundId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('review:addComment', stateMutation(async (_event, { articleId, roundId, payload }) => {
    storage.addReviewComment(articleId, roundId, payload);
    return storage.loadState();
  }));
  ipcMain.handle('review:updateCommentStatus', stateMutation(async (_event, { articleId, roundId, commentId, status }) => {
    storage.updateReviewCommentStatus(articleId, roundId, commentId, status);
    return storage.loadState();
  }));
  ipcMain.handle('review:updateComment', stateMutation(async (_event, { articleId, roundId, commentId, patch }) => {
    storage.updateReviewComment(articleId, roundId, commentId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('review:deleteComment', stateMutation(async (_event, { articleId, roundId, commentId }) => {
    storage.deleteReviewComment(articleId, roundId, commentId);
    return storage.loadState();
  }));
  ipcMain.handle('review:deleteRound', stateMutation(async (_event, { articleId, roundId }) => {
    storage.deleteReviewRound(articleId, roundId);
    return storage.loadState();
  }));
  ipcMain.handle('review:addRevision', async () => storage.loadState());
  ipcMain.handle('review:updateRevision', async () => storage.loadState());
  ipcMain.handle('review:deleteRevision', async () => storage.loadState());
  ipcMain.handle('article:exportMarkdown', async (_event, { articleId }) => storage.exportMarkdown(articleId));
  ipcMain.handle('article:exportReimportableMarkdown', async (_event, { articleId }) => storage.exportReimportableMarkdown(articleId));
  ipcMain.handle('article:exportDocx', async () => path.join(storage.BASE_DIRECTORY, 'Exports', 'demo.docx'));
  ipcMain.handle('article:exportLatex', async () => path.join(storage.BASE_DIRECTORY, 'Exports', 'demo.tex'));
  ipcMain.handle('article:getWritingGuidance', async (_event, { articleId, targetSection }) => storage.getWritingGuidance(articleId, targetSection));
  ipcMain.handle('thesis:create', stateMutation(async (_event, { payload }) => {
    storage.createThesis(payload);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:updateMeta', stateMutation(async (_event, { thesisId, patch }) => {
    storage.updateThesisMeta(thesisId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:addSection', stateMutation(async (_event, { thesisId, sectionType, title }) => {
    storage.addThesisSection(thesisId, sectionType, title);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:linkArticle', stateMutation(async (_event, { thesisId, articleId }) => {
    storage.linkArticleToThesis(thesisId, articleId);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:unlinkArticle', stateMutation(async (_event, { thesisId, articleId }) => {
    storage.unlinkArticleFromThesis(thesisId, articleId);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:delete', stateMutation(async (_event, { thesisId }) => {
    storage.deleteThesis(thesisId);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:addTextBlock', stateMutation(async (_event, { thesisId, sectionId, content, description }) => {
    storage.addThesisTextBlock(thesisId, sectionId, content, description);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:updateTextBlock', stateMutation(async (_event, { thesisId, blockId, content, description }) => {
    storage.updateThesisTextBlock(thesisId, blockId, content, description);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:deleteBlock', stateMutation(async (_event, { thesisId, blockId }) => {
    storage.deleteThesisBlock(thesisId, blockId);
    return storage.loadState();
  }));
  ipcMain.handle('thesis:exportMarkdown', async (_event, { thesisId }) => storage.exportThesisMarkdown(thesisId));
  ipcMain.handle('streak:get', async () => storage.loadState().writingStreak);
  ipcMain.handle('streak:updateGoal', stateMutation(async (_event, { goal }) => {
    storage.updateDailyGoal(goal);
    return storage.loadState();
  }));
  ipcMain.handle('mood:add', stateMutation(async (_event, { mood, note }) => {
    storage.addMoodEntry(mood, note);
    return storage.loadState();
  }));
  ipcMain.handle('mood:getHistory', async () => storage.getMoodHistory());
  ipcMain.handle('pomodoro:addSession', stateMutation(async (_event, { duration, articleId, sectionType }) => {
    storage.addPomodoroSession(duration, articleId, sectionType);
    return storage.loadState();
  }));
  ipcMain.handle('pomodoro:getStats', async () => storage.getPomodoroStats());
  ipcMain.handle('theme:get', async () => storage.getTheme());
  ipcMain.handle('theme:set', stateMutation(async (_event, { theme }) => {
    storage.setTheme(theme);
    return storage.loadState();
  }));
  ipcMain.handle('stats:get', async () => storage.getWritingStats());
  ipcMain.handle('tag:add', stateMutation(async (_event, { articleId, tagName, tagColor }) => {
    storage.addTag(articleId, tagName, tagColor);
    return storage.loadState();
  }));
  ipcMain.handle('tag:remove', stateMutation(async (_event, { articleId, tagId }) => {
    storage.removeTag(articleId, tagId);
    return storage.loadState();
  }));
  ipcMain.handle('citation:add', stateMutation(async (_event, { articleId, citation }) => {
    storage.addCitation(articleId, citation);
    return storage.loadState();
  }));
  ipcMain.handle('citation:update', stateMutation(async (_event, { articleId, citationId, patch }) => {
    storage.updateCitation(articleId, citationId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('citation:delete', stateMutation(async (_event, { articleId, citationId }) => {
    storage.deleteCitation(articleId, citationId);
    return storage.loadState();
  }));
  ipcMain.handle('export:html', async (_event, { articleId }) => storage.exportToHTML(articleId));
  ipcMain.handle('export:json', async (_event, { articleId }) => storage.exportToJSON(articleId));
  ipcMain.handle('export:share', async (_event, { articleId }) => storage.createSharePackage(articleId));
  ipcMain.handle('llm:listProviders', async () => {
    const { providers, activeId } = storage.listProviders();
    return { providers: providers.map((provider) => ({ ...provider, hasApiKey: false })), activeId, presets: PRESETS };
  });
  ipcMain.handle('llm:addProvider', async () => ({ providers: [], activeId: null, presets: PRESETS }));
  ipcMain.handle('llm:updateProvider', async () => ({ providers: [], activeId: null, presets: PRESETS }));
  ipcMain.handle('llm:deleteProvider', async () => ({ providers: [], activeId: null, presets: PRESETS }));
  ipcMain.handle('llm:setActiveProvider', async () => ({ providers: [], activeId: null, presets: PRESETS }));
  ipcMain.handle('llm:testProvider', async () => ({ ok: false, message: 'Promo capture only' }));
  ipcMain.handle('llm:startChat', async () => ({ ok: false, error: '请先在 Settings 配置 Provider。' }));
  ipcMain.handle('llm:cancelSession', async () => null);
  ipcMain.handle('llm:approve', async () => null);
  ipcMain.handle('scenario:list', async () => storage.listWritingScenarios());
  ipcMain.handle('scenario:add', stateMutation(async (_event, { draft }) => storage.addWritingScenario(draft)));
  ipcMain.handle('scenario:update', stateMutation(async (_event, { id, patch }) => storage.updateWritingScenario(id, patch)));
  ipcMain.handle('scenario:delete', stateMutation(async (_event, { id }) => storage.deleteWritingScenario(id)));
  ipcMain.handle('scenario:reset', stateMutation(async (_event, { id }) => storage.resetWritingScenarioToDefault(id)));
  ipcMain.handle('italic:get', async () => storage.getItalicGuide());
  ipcMain.handle('italic:set', stateMutation(async (_event, { config }) => storage.setItalicGuide(config)));
  ipcMain.handle('zotero:getConfig', async () => storage.getZoteroConfig());
  ipcMain.handle('zotero:setConfig', stateMutation(async (_event, { config }) => storage.setZoteroConfig(config)));
  ipcMain.handle('vocab:get', async () => storage.getCustomVocab());
  ipcMain.handle('vocab:addWord', stateMutation(async (_event, { word }) => storage.addCustomVocabWord(word)));
  ipcMain.handle('vocab:removeWord', stateMutation(async (_event, { word }) => storage.removeCustomVocabWord(word)));
  ipcMain.handle('vocab:addPhrase', stateMutation(async (_event, { entry }) => storage.addCustomVocabPhrase(entry)));
  ipcMain.handle('vocab:removePhrase', stateMutation(async (_event, { trigger, text }) => storage.removeCustomVocabPhrase(trigger, text)));
  ipcMain.handle('vocab:clear', stateMutation(async () => storage.clearCustomVocab()));
  ipcMain.handle('vocabPacks:list', async () => storage.listVocabPacks());
  ipcMain.handle('vocabPacks:setEnabled', stateMutation(async (_event, { id, enabled }) => {
    storage.setVocabPackEnabled(id, enabled);
    return storage.loadState();
  }));
  ipcMain.handle('vocabPacks:import', stateMutation(async (_event, { pack }) => {
    storage.importVocabPack(pack);
    return storage.loadState();
  }));
  ipcMain.handle('vocabPacks:delete', stateMutation(async (_event, { id }) => {
    storage.deleteCustomVocabPack(id);
    return storage.loadState();
  }));
  ipcMain.handle('vocabPacks:rename', stateMutation(async (_event, { id, name }) => {
    storage.renameCustomVocabPack(id, name);
    return storage.loadState();
  }));
  ipcMain.handle('vocabPacks:getCustom', async () => storage.getCustomVocabPacks());
  ipcMain.handle('user:getProfile', async () => storage.getUserProfile());
  ipcMain.handle('user:setProfile', stateMutation(async (_event, { patch }) => {
    storage.setUserProfile(patch);
    return storage.loadState();
  }));
  ipcMain.handle('autoApprove:get', async () => storage.getAutoApproveTools());
  ipcMain.handle('autoApprove:set', stateMutation(async (_event, { value }) => storage.setAutoApproveTools(value)));
  ipcMain.handle('progress:add', stateMutation(async (_event, { payload }) => {
    storage.addProgressEntry(payload);
    return storage.loadState();
  }));
  ipcMain.handle('progress:update', stateMutation(async (_event, { entryId, patch }) => {
    storage.updateProgressEntry(entryId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('progress:delete', stateMutation(async (_event, { entryId }) => {
    storage.deleteProgressEntry(entryId);
    return storage.loadState();
  }));
  ipcMain.handle('progress:list', async (_event, { filter }) => storage.listProgressEntries(filter || {}));
  ipcMain.handle('progress:link', stateMutation(async (_event, { entryId, findingId }) => {
    storage.linkProgressEntryToFinding(entryId, findingId);
    return storage.loadState();
  }));
  ipcMain.handle('finding:add', stateMutation(async (_event, { articleId, sectionType, payload }) => {
    storage.addFinding(articleId, sectionType, payload);
    return storage.loadState();
  }));
  ipcMain.handle('finding:update', stateMutation(async (_event, { articleId, findingId, patch }) => {
    storage.updateFinding(articleId, findingId, patch);
    return storage.loadState();
  }));
  ipcMain.handle('finding:delete', stateMutation(async (_event, { articleId, findingId }) => {
    storage.deleteFinding(articleId, findingId);
    return storage.loadState();
  }));
  ipcMain.handle('finding:list', async (_event, { articleId, sectionType }) => storage.listFindings(articleId, sectionType));
  ipcMain.handle('daily:start', stateMutation(async (_event, { date, planText }) => {
    storage.startDailySession(date, planText);
    return storage.loadState();
  }));
  ipcMain.handle('daily:setPlan', stateMutation(async (_event, { date, planText }) => {
    storage.setDailyPlan(date, planText);
    return storage.loadState();
  }));
  ipcMain.handle('daily:end', stateMutation(async (_event, { date, summaryText }) => {
    storage.endDailySession(date, summaryText);
    return storage.loadState();
  }));
  ipcMain.handle('daily:get', async (_event, { date }) => storage.getDailySession(date));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(attempt, 250);
    };
    attempt();
  });
}

async function waitFor(win, expression, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ok = await win.webContents.executeJavaScript(`Boolean(${expression})`, true);
    if (ok) return;
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function click(win, selector) {
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()
  `, true);
  if (!clicked) throw new Error(`Selector not found: ${selector}`);
  await delay(700);
}

async function clickByText(win, selector, text) {
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const el = nodes.find((node) => node.textContent && node.textContent.includes(${JSON.stringify(text)}));
      if (!el) return false;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    })()
  `, true);
  if (!clicked) throw new Error(`Element not found: ${selector} containing ${text}`);
  await delay(900);
}

async function setTheme(win, theme) {
  await win.webContents.executeJavaScript(`
    (async () => {
      await window.scipaper.setTheme(${JSON.stringify(theme)});
      document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
    })()
  `, true);
  await delay(900);
}

async function capture(win, filename) {
  await delay(300);
  const image = await win.webContents.capturePage();
  const outputPath = path.join(screenshotDir, filename);
  fs.writeFileSync(outputPath, image.toPNG());
  console.log(`captured ${path.relative(repoRoot, outputPath)}`);
}

async function main() {
  seedDemoData();
  registerIpc();
  fs.mkdirSync(screenshotDir, { recursive: true });

  const port = await getFreePort();
  const viteUrl = `http://127.0.0.1:${port}`;
  const nodeBin = process.env.npm_node_execpath || 'node';
  const vite = spawn(nodeBin, [
    path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ], {
    cwd: repoRoot,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  vite.stdout.on('data', (chunk) => process.stdout.write(chunk));
  vite.stderr.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitForHttp(viteUrl);
    await app.whenReady();

    console.log('loading renderer...');
    const win = new BrowserWindow({
      width: 1600,
      height: 1000,
      useContentSize: true,
      show: true,
      backgroundColor: '#fbfaf7',
      webPreferences: {
        preload: path.join(repoRoot, 'electron', 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    win.webContents.on('console-message', (_event, level, message) => {
      if (level >= 2) console.log(`[renderer:${level}] ${message}`);
    });
    win.webContents.on('render-process-gone', (_event, details) => {
      console.error('renderer gone:', details);
    });
    win.webContents.on('did-fail-load', (_event, code, description, url) => {
      console.error(`load failed ${code} ${description}: ${url}`);
    });

    await win.loadURL(viteUrl);
    console.log('renderer loaded, waiting for home...');
    await waitFor(win, "document.querySelector('.home-route') && !document.querySelector('.splash-screen')", 20000);
    await delay(600);

    await setTheme(win, 'claude');
    await capture(win, 'promo-home-dashboard.png');
    await capture(win, 'promo-theme-claude.png');

    await click(win, '[aria-label="Library"]');
    await waitFor(win, "document.querySelector('.library-grid')");
    await capture(win, 'promo-library.png');

    await clickByText(win, '.library-card', 'ABA pulse memory');
    await waitFor(win, "document.querySelector('.article-view')");
    await capture(win, 'promo-article-workspace.png');

    await click(win, '.enter-writing');
    await waitFor(win, "document.querySelector('[data-focus-mode] .focus-mode-editor-host')");
    await capture(win, 'promo-focus-writing.png');

    await click(win, '[data-focus-mode] button[aria-label="AI 助手"]');
    await waitFor(win, "document.querySelector('.ai-drawer')");
    await capture(win, 'promo-focus-ai.png');

    await click(win, '.ai-drawer-close');
    await click(win, 'button[aria-label="退出沉浸写作"]');
    await waitFor(win, "document.querySelector('.article-view') && !document.querySelector('[data-focus-mode]')");
    await click(win, '[aria-label="Settings"]');
    await waitFor(win, "document.querySelector('.settings-view')");
    await capture(win, 'promo-settings.png');

    await click(win, '[aria-label="Home"]');
    await waitFor(win, "document.querySelector('.home-route')");
    await setTheme(win, 'pixel');
    await capture(win, 'promo-theme-pixel.png');

    await setTheme(win, 'fresh');
    await capture(win, 'promo-theme-fresh.png');

    win.destroy();
  } finally {
    vite.kill('SIGTERM');
    await delay(500);
  }

  app.quit();
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
