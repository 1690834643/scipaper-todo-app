const { clipboard, contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scipaper', {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  getMcpInfo: () => ipcRenderer.invoke('app:getMcpInfo'),
  createArticle: (payload) => ipcRenderer.invoke('article:create', payload),
  updateArticleMeta: (articleId, patch) => ipcRenderer.invoke('article:updateMeta', { articleId, patch }),
  updateResearchContext: (articleId, researchContext) =>
    ipcRenderer.invoke('article:updateResearchContext', { articleId, researchContext }),
  addTextBlock: (articleId, sectionType, content, description) =>
    ipcRenderer.invoke('block:addText', { articleId, sectionType, content, description }),
  updateTextBlock: (articleId, blockId, content, description) =>
    ipcRenderer.invoke('block:updateText', { articleId, blockId, content, description }),
  recordBlockVersion: (articleId, blockId, changeDescription) =>
    ipcRenderer.invoke('block:recordVersion', { articleId, blockId, changeDescription }),
  deleteBlock: (articleId, blockId) => ipcRenderer.invoke('block:delete', { articleId, blockId }),
  addAnnotation: (articleId, blockId, payload) =>
    ipcRenderer.invoke('annotation:add', { articleId, blockId, payload }),
  updateAnnotation: (articleId, annotationId, patch) =>
    ipcRenderer.invoke('annotation:update', { articleId, annotationId, patch }),
  deleteAnnotation: (articleId, annotationId) =>
    ipcRenderer.invoke('annotation:delete', { articleId, annotationId }),
  annotateText: (params) => ipcRenderer.invoke('llm:annotateText', params),
  llmKeyStoreInfo: () => ipcRenderer.invoke('llm:keyStoreInfo'),
  importAssetBlock: (articleId, sectionType, kind) =>
    ipcRenderer.invoke('block:importAsset', { articleId, sectionType, kind }),
  openBlockAsset: (articleId, blockId) => ipcRenderer.invoke('block:openAsset', { articleId, blockId }),
  getBlockPreview: (articleId, blockId) => ipcRenderer.invoke('block:getPreview', { articleId, blockId }),
  openArticleFolder: (articleId) => ipcRenderer.invoke('article:openFolder', { articleId }),
  addReviewRound: (articleId, payload) => ipcRenderer.invoke('review:addRound', { articleId, payload }),
  addReviewComment: (articleId, roundId, payload) =>
    ipcRenderer.invoke('review:addComment', { articleId, roundId, payload }),
  updateReviewCommentStatus: (articleId, roundId, commentId, status) =>
    ipcRenderer.invoke('review:updateCommentStatus', { articleId, roundId, commentId, status }),
  addRevision: (articleId, roundId, commentId, payload) =>
    ipcRenderer.invoke('review:addRevision', { articleId, roundId, commentId, payload }),
  exportMarkdown: (articleId) => ipcRenderer.invoke('article:exportMarkdown', { articleId }),
  exportArticleDocx: (articleId, templateId, applyItalicGuide) =>
    ipcRenderer.invoke('article:exportDocx', { articleId, templateId, applyItalicGuide }),
  exportArticleLatex: (articleId) => ipcRenderer.invoke('article:exportLatex', { articleId }),
  getWritingGuidance: (articleId, targetSection) =>
    ipcRenderer.invoke('article:getWritingGuidance', { articleId, targetSection }),
  copyText: (text) => clipboard.writeText(text),
  onStateChanged: (listener) => {
    const handler = () => listener()
    ipcRenderer.on('state:changed', handler)
    return () => ipcRenderer.removeListener('state:changed', handler)
  },
  // Thesis operations
  createThesis: (payload) => ipcRenderer.invoke('thesis:create', payload),
  updateThesisMeta: (thesisId, patch) => ipcRenderer.invoke('thesis:updateMeta', { thesisId, patch }),
  addThesisSection: (thesisId, sectionType, title) => ipcRenderer.invoke('thesis:addSection', { thesisId, sectionType, title }),
  linkArticleToThesis: (thesisId, articleId) => ipcRenderer.invoke('thesis:linkArticle', { thesisId, articleId }),
  unlinkArticleFromThesis: (thesisId, articleId) => ipcRenderer.invoke('thesis:unlinkArticle', { thesisId, articleId }),
  // Writing streak operations
  getWritingStreak: () => ipcRenderer.invoke('streak:get'),
  updateDailyGoal: (goal) => ipcRenderer.invoke('streak:updateGoal', { goal }),
  // Mood tracking operations
  addMoodEntry: (mood, note) => ipcRenderer.invoke('mood:add', { mood, note }),
  getMoodHistory: () => ipcRenderer.invoke('mood:getHistory'),
  // Pomodoro operations
  addPomodoroSession: (duration, articleId, sectionType) => ipcRenderer.invoke('pomodoro:addSession', { duration, articleId, sectionType }),
  getPomodoroStats: () => ipcRenderer.invoke('pomodoro:getStats'),
  // Theme operations
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', { theme }),
  // Writing stats
  getWritingStats: () => ipcRenderer.invoke('stats:get'),
  // Tag operations
  addTag: (articleId, tagName, tagColor) => ipcRenderer.invoke('tag:add', { articleId, tagName, tagColor }),
  removeTag: (articleId, tagId) => ipcRenderer.invoke('tag:remove', { articleId, tagId }),
  // Citation operations
  addCitation: (articleId, citation) => ipcRenderer.invoke('citation:add', { articleId, citation }),
  // Export operations
  exportToHTML: (articleId) => ipcRenderer.invoke('export:html', { articleId }),
  exportToJSON: (articleId) => ipcRenderer.invoke('export:json', { articleId }),
  createSharePackage: (articleId) => ipcRenderer.invoke('export:share', { articleId }),

  // LLM provider management
  llmListProviders: () => ipcRenderer.invoke('llm:listProviders'),
  llmAddProvider: (draft) => ipcRenderer.invoke('llm:addProvider', { draft }),
  llmUpdateProvider: (id, patch) => ipcRenderer.invoke('llm:updateProvider', { id, patch }),
  llmDeleteProvider: (id) => ipcRenderer.invoke('llm:deleteProvider', { id }),
  llmSetActiveProvider: (id) => ipcRenderer.invoke('llm:setActiveProvider', { id }),
  llmTestProvider: (id) => ipcRenderer.invoke('llm:testProvider', { id }),

  // LLM chat
  llmStartChat: (params) => ipcRenderer.invoke('llm:startChat', params),
  llmCancelSession: (sessionId) => ipcRenderer.invoke('llm:cancelSession', { sessionId }),
  llmApprove: (sessionId, callId, approved, alwaysAllow) =>
    ipcRenderer.invoke('llm:approve', { sessionId, callId, approved, alwaysAllow }),
  llmOnEvent: (listener) => {
    const eventHandler = (_event, payload) => listener({ ...payload, _channel: 'event' })
    const toolHandler = (_event, payload) => listener({ ...payload, _channel: 'toolEvent' })
    ipcRenderer.on('llm:event', eventHandler)
    ipcRenderer.on('llm:toolEvent', toolHandler)
    return () => {
      ipcRenderer.removeListener('llm:event', eventHandler)
      ipcRenderer.removeListener('llm:toolEvent', toolHandler)
    }
  },

  // Writing scenarios
  listScenarios: () => ipcRenderer.invoke('scenario:list'),
  addScenario: (draft) => ipcRenderer.invoke('scenario:add', { draft }),
  updateScenario: (id, patch) => ipcRenderer.invoke('scenario:update', { id, patch }),
  deleteScenario: (id) => ipcRenderer.invoke('scenario:delete', { id }),
  resetScenarioToDefault: (id) => ipcRenderer.invoke('scenario:reset', { id }),

  // Italic guide
  getItalicGuide: () => ipcRenderer.invoke('italic:get'),
  setItalicGuide: (config) => ipcRenderer.invoke('italic:set', { config }),

  // Auto-approve tool calls
  getAutoApproveTools: () => ipcRenderer.invoke('autoApprove:get'),
  setAutoApproveTools: (value) => ipcRenderer.invoke('autoApprove:set', { value }),

  // Zotero
  getZoteroConfig: () => ipcRenderer.invoke('zotero:getConfig'),
  setZoteroConfig: (config) => ipcRenderer.invoke('zotero:setConfig', { config }),

  // Custom autocomplete vocabulary
  getCustomVocab: () => ipcRenderer.invoke('vocab:get'),
  addCustomVocabWord: (word) => ipcRenderer.invoke('vocab:addWord', { word }),
  removeCustomVocabWord: (word) => ipcRenderer.invoke('vocab:removeWord', { word }),
  addCustomVocabPhrase: (entry) => ipcRenderer.invoke('vocab:addPhrase', { entry }),
  removeCustomVocabPhrase: (trigger, text) => ipcRenderer.invoke('vocab:removePhrase', { trigger, text }),
  clearCustomVocab: () => ipcRenderer.invoke('vocab:clear'),

  // Vocab pack registry
  listVocabPacks: () => ipcRenderer.invoke('vocabPacks:list'),
  setVocabPackEnabled: (id, enabled) => ipcRenderer.invoke('vocabPacks:setEnabled', { id, enabled }),
  importVocabPack: (pack) => ipcRenderer.invoke('vocabPacks:import', { pack }),
  deleteCustomVocabPack: (id) => ipcRenderer.invoke('vocabPacks:delete', { id }),
  renameCustomVocabPack: (id, name) => ipcRenderer.invoke('vocabPacks:rename', { id, name }),
  getCustomVocabPacks: () => ipcRenderer.invoke('vocabPacks:getCustom'),

  // Progress entries / Findings / Daily session
  addProgressEntry: (payload) => ipcRenderer.invoke('progress:add', { payload }),
  updateProgressEntry: (entryId, patch) => ipcRenderer.invoke('progress:update', { entryId, patch }),
  deleteProgressEntry: (entryId) => ipcRenderer.invoke('progress:delete', { entryId }),
  listProgressEntries: (filter) => ipcRenderer.invoke('progress:list', { filter }),
  linkProgressToFinding: (entryId, findingId) => ipcRenderer.invoke('progress:link', { entryId, findingId }),
  addFinding: (articleId, sectionType, payload) => ipcRenderer.invoke('finding:add', { articleId, sectionType, payload }),
  updateFinding: (articleId, findingId, patch) => ipcRenderer.invoke('finding:update', { articleId, findingId, patch }),
  deleteFinding: (articleId, findingId) => ipcRenderer.invoke('finding:delete', { articleId, findingId }),
  listFindings: (articleId, sectionType) => ipcRenderer.invoke('finding:list', { articleId, sectionType }),
  startDailySession: (date, planText) => ipcRenderer.invoke('daily:start', { date, planText }),
  setDailyPlan: (date, planText) => ipcRenderer.invoke('daily:setPlan', { date, planText }),
  endDailySession: (date, summaryText) => ipcRenderer.invoke('daily:end', { date, summaryText }),
  getDailySession: (date) => ipcRenderer.invoke('daily:get', { date }),
});
