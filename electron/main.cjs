const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const {
  addAssetBlock,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  addReviewComment,
  updateReviewRound,
  updateReviewComment,
  deleteReviewComment,
  deleteReviewRound,
  importReviewComments,
  DATABASE_PATH,
  addReviewRound,
  addRevision,
  updateRevision,
  deleteRevision,
  addTextBlock,
  importManuscriptSections,
  undoLastImportBatch,
  deleteBlock,
  exportMarkdown,
  getArticleDirectory,
  getPreviewPayload,
  getWritingGuidance,
  loadState,
  openPathForBlock,
  updateArticleMeta,
  updateResearchContext,
  updateReviewCommentStatus,
  updateTextBlockWithStreak,
  recordBlockVersion,
  createArticle,
  deleteArticle,
  createThesis,
  updateThesisMeta,
  addThesisSection,
  linkArticleToThesis,
  unlinkArticleFromThesis,
  deleteThesis,
  addThesisTextBlock,
  updateThesisTextBlock,
  deleteThesisBlock,
  exportThesisMarkdown,
  updateDailyGoal,
  addMoodEntry,
  getMoodHistory,
  addPomodoroSession,
  getPomodoroStats,
  BASE_DIRECTORY,
  getTheme,
  setTheme,
  getWritingStats,
  addCitation,
  updateCitation,
  deleteCitation,
  addTag,
  removeTag,
  exportToHTML,
  exportToJSON,
  createSharePackage,
  exportFullBackup,
  restoreFullBackup,
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
  getAutoApproveTools,
  setAutoApproveTools,
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
} = require('./storage.cjs');
const { startMcpServer } = require('./mcp-server.cjs');
const { extractTextFromFile } = require('./importText.cjs');
const {
  listProviders,
  addProvider: addProviderStorage,
  updateProvider: updateProviderStorage,
  deleteProvider: deleteProviderStorage,
  setActiveProvider: setActiveProviderStorage,
} = require('./storage.cjs');
const llmKeyStore = require('./llmKeyStore.cjs');
const llmClient = require('./llmClient.cjs');
const { exportArticleDocx } = require('./docxExporter.cjs');
const { exportArticleLatex } = require('./latexExporter.cjs');

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const isMcpMode = process.argv.includes('--mcp-server');
const isMac = process.platform === 'darwin';

// macOS 打包后 GUI 二进制路径含 ".app/Contents/MacOS/<name>"，含空格 + Cursor /
// Claude Code 在解析时容易出错。优先使用 process.resourcesPath 下解 asar 后
// 的纯 .cjs 文件，让外部 MCP 客户端用 `node` 跑而非启动 GUI 进程。
function mcpCliPath() {
  if (isMac && app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'mcp-cli.cjs');
  }
  return path.join(__dirname, 'mcp-cli.cjs');
}

function buildMcpServerEntry(clientName, options = {}) {
  if (isMac && !options.useGuiBinary) {
    return {
      command: 'node',
      args: [mcpCliPath()],
      env: { SCIPAPER_MCP_CLIENT: clientName },
    };
  }
  return {
    command: process.execPath,
    args: ['--mcp-server'],
    env: { SCIPAPER_MCP_CLIENT: clientName },
  };
}

function buildMcpInfo() {
  const genericEntry = buildMcpServerEntry('Cursor');
  const genericConfig = {
    mcpServers: { 'scipaper-todo': genericEntry },
  };

  const config = {
    mcpServers: { 'scipaper-todo': genericEntry },
  };

  return {
    command: genericEntry.command,
    args: genericEntry.args,
    baseDirectory: BASE_DIRECTORY,
    configJson: JSON.stringify(config, null, 2),
    examples: {
      generic: JSON.stringify(genericConfig, null, 2),
      cursor: JSON.stringify(genericConfig, null, 2),
      claudeCode: JSON.stringify(
        {
          mcpServers: {
            'scipaper-todo': buildMcpServerEntry('Claude Code'),
          },
        },
        null,
        2,
      ),
      // 备选：直接调 GUI 二进制（macOS 下不推荐，需手动转义路径）
      guiBinary: JSON.stringify(
        {
          mcpServers: {
            'scipaper-todo': buildMcpServerEntry('Cursor', { useGuiBinary: true }),
          },
        },
        null,
        2,
      ),
    },
  };
}

function configureApplicationMenu() {
  if (!isMac) return;
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  // Force-maximize on launch — the immersive editor + section nav + AI drawer
  // need real estate, and the previous "1520×980" default left users with a
  // cramped layout where the AI input bar and chapter chips were unreachable.
  const window = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#f4ecde',
    autoHideMenuBar: true,
    show: false,
    title: 'SciPaper Todo',
    // BrowserWindow icon is mainly for Linux + dev. Windows reads the icon
    // from the packaged .exe resources (set via win.icon in build config),
    // macOS reads it from the .app bundle (mac.icon → icon.icns).
    icon: path.join(__dirname, '..', 'build',
      process.platform === 'win32' ? 'icon.ico'
      : process.platform === 'darwin' ? 'icon.icns'
      : 'icon-1024.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });
  // Re-maximize if the user un-maximizes — the layout cannot accommodate
  // floating window sizes. Discussed with user 2026-05-03; this is the only
  // viable workaround until a fully responsive redesign lands.
  window.on('unmaximize', () => {
    window.maximize();
  });

  if (isDev) {
    window.loadURL(process.env.VITE_DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

let stateMutationQueue = Promise.resolve();

function enqueueStateMutation(job) {
  const next = stateMutationQueue.then(job, job);
  stateMutationQueue = next.catch(() => {});
  return next;
}

function wrapMutation(handler) {
  return (...args) => enqueueStateMutation(() => handler(...args));
}

function wrapStateMutation(handler) {
  return (...args) =>
    enqueueStateMutation(async () => {
      await handler(...args);
      return loadState();
    });
}

function broadcastStateChanged() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('state:changed');
    }
  }
}

function startDatabaseWatch() {
  fs.watchFile(
    DATABASE_PATH,
    { interval: 1200 },
    (current, previous) => {
      if (current.mtimeMs !== previous.mtimeMs) {
        broadcastStateChanged();
      }
    },
  );
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', async () => loadState());
  ipcMain.handle('app:getMcpInfo', async () => buildMcpInfo());
  ipcMain.handle('data:openFolder', async () => {
    fs.mkdirSync(BASE_DIRECTORY, { recursive: true });
    await shell.openPath(BASE_DIRECTORY);
    return true;
  });
  ipcMain.handle('data:exportBackup', async () => {
    const browserWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const dialogResult = await dialog.showOpenDialog(browserWindow, {
      title: '选择备份保存位置',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) return null;
    const backupPath = exportFullBackup(dialogResult.filePaths[0]);
    await shell.showItemInFolder(backupPath);
    return { backupPath };
  });
  ipcMain.handle('data:restoreBackup', wrapMutation(async () => {
    const browserWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const dialogResult = await dialog.showOpenDialog(browserWindow, {
      title: '选择 SciPaper Todo 备份文件',
      properties: ['openFile'],
      filters: [
        { name: 'SciPaper Todo Backup', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) return null;
    const result = restoreFullBackup(dialogResult.filePaths[0]);
    return { ...result, state: loadState() };
  }));

  ipcMain.handle(
    'article:create',
    wrapStateMutation(async (_event, payload) => {
      createArticle(payload);
    }),
  );
  ipcMain.handle(
    'article:delete',
    wrapStateMutation(async (_event, { articleId }) => {
      deleteArticle(articleId);
    }),
  );
  ipcMain.handle(
    'article:updateMeta',
    wrapStateMutation(async (_event, { articleId, patch }) => {
      updateArticleMeta(articleId, patch);
    }),
  );
  ipcMain.handle(
    'article:updateResearchContext',
    wrapStateMutation(async (_event, { articleId, researchContext }) => {
      updateResearchContext(articleId, researchContext);
    }),
  );
  ipcMain.handle(
    'block:addText',
    wrapStateMutation(async (_event, { articleId, sectionType, content, description }) => {
      addTextBlock(articleId, sectionType, content, description);
    }),
  );
  ipcMain.handle(
    'block:updateText',
    wrapStateMutation(async (_event, { articleId, blockId, content, description }) => {
      updateTextBlockWithStreak(articleId, blockId, content, description);
    }),
  );
  ipcMain.handle(
    'block:recordVersion',
    wrapStateMutation(async (_event, { articleId, blockId, changeDescription }) => {
      recordBlockVersion(articleId, blockId, changeDescription);
    }),
  );
  ipcMain.handle(
    'block:delete',
    wrapStateMutation(async (_event, { articleId, blockId }) => {
      deleteBlock(articleId, blockId);
    }),
  );
  ipcMain.handle(
    'annotation:add',
    wrapStateMutation(async (_event, { articleId, blockId, payload }) => {
      addAnnotation(articleId, blockId, payload);
    }),
  );
  ipcMain.handle(
    'annotation:update',
    wrapStateMutation(async (_event, { articleId, annotationId, patch }) => {
      updateAnnotation(articleId, annotationId, patch);
    }),
  );
  ipcMain.handle(
    'annotation:delete',
    wrapStateMutation(async (_event, { articleId, annotationId }) => {
      deleteAnnotation(articleId, annotationId);
    }),
  );
  ipcMain.handle('llm:keyStoreInfo', async () => llmKeyStore.getStorageInfo());
  ipcMain.handle(
    'llm:annotateText',
    async (_event, { sectionType, anchorText, contextBefore, contextAfter, providerId, articleLanguage }) => {
      const langDesc = articleLanguage === 'zh' ? '中文' : '英文';
      const langSpecificFocus = articleLanguage === 'zh'
        ? '中文学术口吻、术语规范、句式连贯'
        : '英文学术口吻、时态/语态、术语一致性、冠词、词语搭配';
      const SYSTEM_PROMPT =
        `你是学术写作的批注助手，正在审阅一段 ${langDesc} SCI 论文。` +
        '用户提供一段正文以及前后语境，你写一条简短的批注。\n\n' +
        '要求：\n' +
        '- 像 Word 批注或 Google Docs suggestion，绝不改写或重写原文\n' +
        '- 一律用中文回答（用户是中文研究者，需要中文反馈）\n' +
        `- 关注：语病、用词不准、逻辑链断裂、缺失证据、引用缺失、${langSpecificFocus}\n` +
        '- 直接说事，不寒暄，不要"以下是我的批注"这种开场\n' +
        '- 1 到 3 句话，不超过 80 个汉字\n\n' +
        `- 如果要给改写示范或词语候选，用 ${langDesc}（与原文一致）\n` +
        '- 如果原文没明显问题，给一句具体的正面观察，不要敷衍式好评\n\n' +
        '只输出批注本体，无任何前后缀。';
      const userMessage =
        `章节：${sectionType}\n\n` +
        `【前文语境】${(contextBefore || '').slice(-200) || '（开头）'}\n\n` +
        `【批注对象】${anchorText}\n\n` +
        `【后文语境】${(contextAfter || '').slice(0, 200) || '（末尾）'}`;
      const text = await llmClient.simpleComplete({
        providerId: providerId || undefined,
        system: SYSTEM_PROMPT,
        userMessage,
        maxTokens: 400,
      });
      return { ok: true, comment: String(text || '').trim() };
    },
  );
  ipcMain.handle(
    'block:importAsset',
    wrapStateMutation(async (event, { articleId, sectionType, kind }) => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const filters =
        kind === 'image'
          ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tif', 'tiff'] }]
          : [{ name: 'Files', extensions: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', '*'] }];
      const dialogResult = await dialog.showOpenDialog(browserWindow, {
        title: kind === 'image' ? '选择图片附件' : '选择外部文件',
        properties: ['openFile', 'multiSelections'],
        filters,
      });

      if (dialogResult.canceled) {
        return;
      }

      for (const filePath of dialogResult.filePaths) {
        addAssetBlock(articleId, sectionType, kind, filePath);
      }
    }),
  );
  ipcMain.handle('import:selectTextFile', async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const dialogResult = await dialog.showOpenDialog(browserWindow, {
      title: '选择要导入的文本文件',
      properties: ['openFile'],
      filters: [
        { name: 'Manuscript / Review text', extensions: ['txt', 'md', 'markdown', 'docx', 'pdf'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return null;
    }

    const filePath = dialogResult.filePaths[0];
    const stats = fs.statSync(filePath);
    if (stats.size > 2 * 1024 * 1024) {
      throw new Error('导入文件超过 2MB，请先复制需要导入的主体文本。');
    }

    return {
      filePath,
      fileName: path.basename(filePath),
      text: extractTextFromFile(filePath),
    };
  });
  ipcMain.handle(
    'import:manuscriptSections',
    wrapStateMutation(async (_event, { articleId, sections, mode }) => {
      importManuscriptSections(articleId, sections, mode || 'append');
    }),
  );
  ipcMain.handle(
    'import:reviewComments',
    wrapStateMutation(async (_event, { articleId, payload }) => {
      importReviewComments(articleId, payload);
    }),
  );
  ipcMain.handle(
    'import:undoLast',
    wrapStateMutation(async (_event, { articleId }) => {
      undoLastImportBatch(articleId);
    }),
  );
  ipcMain.handle('import:reformatText', async (_event, { text, mode, articleLanguage, providerId }) => {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('没有可整理的文本');
    const isReview = mode === 'review';
    const system = isReview
      ? '你是科研论文返修助手。请只整理用户提供的审稿意见文本，不添加新事实，不删除实质性意见。'
      : '你是科研论文手稿整理助手。请只整理用户提供的手稿抽取文本，不添加新事实，不改写科学结论。';
    const userMessage = isReview
      ? [
          '请把下面从 Word/PDF 抽取出的审稿意见整理成清晰纯文本，方便后续导入系统。',
          '要求：',
          '1. 保留 Reviewer 1 / Reviewer 2 / Editor 分组。',
          '2. 每个审稿人下把意见整理成 Comment 1、Comment 2 等编号。',
          '3. 保留 Major/Minor 字样；如果原文没有，不要强行编造。',
          '4. 删除目录、页码、HYPERLINK、TOC、页眉页脚、重复空行。',
          '5. 只输出整理后的文本。',
          '',
          cleanText.slice(0, 50000),
        ].join('\n')
      : [
          '请把下面从 Word/PDF 抽取出的手稿正文整理成清晰纯文本，方便后续按章节导入。',
          `论文语言：${articleLanguage === 'zh' ? '中文' : '英文'}`,
          '要求：',
          '1. 保留并规范章节标题：Title, Abstract, Introduction, Materials and Methods, Results, Discussion, References。',
          '2. 中文论文也请在每个章节前加一行对应英文标准标题，后面保留原正文。',
          '3. 删除目录、页码、HYPERLINK、TOC、页眉页脚、重复空行。',
          '4. 不新增实验结果，不改写科学含义。',
          '5. 只输出整理后的正文文本。',
          '',
          cleanText.slice(0, 50000),
        ].join('\n');
    const output = await llmClient.simpleComplete({
      providerId: providerId || undefined,
      system,
      userMessage,
      maxTokens: 12000,
    });
    return { text: String(output || '').trim() };
  });
  ipcMain.handle('block:openAsset', async (_event, { articleId, blockId }) => {
    try {
      const resolvedPath = openPathForBlock(articleId, blockId);

      if (!resolvedPath) {
        return false;
      }

      await shell.openPath(resolvedPath);
      return true;
    } catch (error) {
      // resolveBlockPath null / shell.openPath 失败统一兜底为 false，
      // renderer 侧只看 boolean，不 reject promise。
      console.error('block:openAsset failed', error);
      return false;
    }
  });
  ipcMain.handle('block:getPreview', async (_event, { articleId, blockId }) => {
    const payload = getPreviewPayload(articleId, blockId);

    if (payload.previewKind === 'tiff' || payload.previewKind === 'pdf') {
      try {
        return {
          ...payload,
          bufferBase64: fs.readFileSync(payload.path).toString('base64'),
        };
      } catch {
        return { ...payload, error: 'File not found or unreadable' };
      }
    }

    return payload;
  });
  ipcMain.handle('article:openFolder', async (_event, { articleId }) => {
    await shell.openPath(getArticleDirectory(articleId));
    return true;
  });
  ipcMain.handle(
    'review:addRound',
    wrapStateMutation(async (_event, { articleId, payload }) => {
      addReviewRound(articleId, payload);
    }),
  );
  ipcMain.handle(
    'review:addComment',
    wrapStateMutation(async (_event, { articleId, roundId, payload }) => {
      addReviewComment(articleId, roundId, payload);
    }),
  );
  ipcMain.handle(
    'review:updateRound',
    wrapStateMutation(async (_event, { articleId, roundId, patch }) => {
      updateReviewRound(articleId, roundId, patch);
    }),
  );
  ipcMain.handle(
    'review:updateCommentStatus',
    wrapStateMutation(async (_event, { articleId, roundId, commentId, status }) => {
      updateReviewCommentStatus(articleId, roundId, commentId, status);
    }),
  );
  ipcMain.handle(
    'review:updateComment',
    wrapStateMutation(async (_event, { articleId, roundId, commentId, patch }) => {
      updateReviewComment(articleId, roundId, commentId, patch);
    }),
  );
  ipcMain.handle(
    'review:deleteComment',
    wrapStateMutation(async (_event, { articleId, roundId, commentId }) => {
      deleteReviewComment(articleId, roundId, commentId);
    }),
  );
  ipcMain.handle(
    'review:deleteRound',
    wrapStateMutation(async (_event, { articleId, roundId }) => {
      deleteReviewRound(articleId, roundId);
    }),
  );
  ipcMain.handle(
    'review:addRevision',
    wrapStateMutation(async (_event, { articleId, roundId, commentId, payload }) => {
      addRevision(articleId, roundId, commentId, payload);
    }),
  );
  ipcMain.handle(
    'review:updateRevision',
    wrapStateMutation(async (_event, { articleId, roundId, commentId, revisionId, patch }) => {
      updateRevision(articleId, roundId, commentId, revisionId, patch);
    }),
  );
  ipcMain.handle(
    'review:deleteRevision',
    wrapStateMutation(async (_event, { articleId, roundId, commentId, revisionId }) => {
      deleteRevision(articleId, roundId, commentId, revisionId);
    }),
  );
  ipcMain.handle('article:exportMarkdown', async (_event, { articleId }) => {
    const exportPath = exportMarkdown(articleId);
    await shell.showItemInFolder(exportPath);
    return exportPath;
  });
  ipcMain.handle('article:exportDocx', async (_event, { articleId, templateId, applyItalicGuide }) => {
    const exportPath = await exportArticleDocx(articleId, templateId, { applyItalicGuide: !!applyItalicGuide });
    await shell.showItemInFolder(exportPath);
    return exportPath;
  });
  ipcMain.handle('article:exportLatex', async (_event, { articleId }) => {
    const exportPath = exportArticleLatex(articleId);
    await shell.showItemInFolder(exportPath);
    return exportPath;
  });
  ipcMain.handle('article:getWritingGuidance', async (_event, { articleId, targetSection }) =>
    getWritingGuidance(articleId, targetSection),
  );

  // Thesis operations
  ipcMain.handle(
    'thesis:create',
    wrapStateMutation(async (_event, payload) => {
      createThesis(payload);
    }),
  );

  ipcMain.handle(
    'thesis:updateMeta',
    wrapStateMutation(async (_event, { thesisId, patch }) => {
      updateThesisMeta(thesisId, patch);
    }),
  );

  ipcMain.handle(
    'thesis:addSection',
    wrapStateMutation(async (_event, { thesisId, sectionType, title }) => {
      addThesisSection(thesisId, sectionType, title);
    }),
  );

  ipcMain.handle(
    'thesis:linkArticle',
    wrapStateMutation(async (_event, { thesisId, articleId }) => {
      linkArticleToThesis(thesisId, articleId);
    }),
  );

  ipcMain.handle(
    'thesis:unlinkArticle',
    wrapStateMutation(async (_event, { thesisId, articleId }) => {
      unlinkArticleFromThesis(thesisId, articleId);
    }),
  );

  ipcMain.handle(
    'thesis:delete',
    wrapStateMutation(async (_event, { thesisId }) => {
      deleteThesis(thesisId);
    }),
  );
  ipcMain.handle(
    'thesis:addTextBlock',
    wrapStateMutation(async (_event, { thesisId, sectionId, content, description }) => {
      addThesisTextBlock(thesisId, sectionId, content, description);
    }),
  );
  ipcMain.handle(
    'thesis:updateTextBlock',
    wrapStateMutation(async (_event, { thesisId, blockId, content, description }) => {
      updateThesisTextBlock(thesisId, blockId, content, description);
    }),
  );
  ipcMain.handle(
    'thesis:deleteBlock',
    wrapStateMutation(async (_event, { thesisId, blockId }) => {
      deleteThesisBlock(thesisId, blockId);
    }),
  );
  ipcMain.handle('thesis:exportMarkdown', async (_event, { thesisId }) => {
    const exportPath = exportThesisMarkdown(thesisId);
    await shell.showItemInFolder(exportPath);
    return exportPath;
  });

  // Writing streak operations
  ipcMain.handle('streak:get', async () => {
    const state = loadState();
    return state.writingStreak;
  });

  ipcMain.handle(
    'streak:updateGoal',
    wrapStateMutation(async (_event, { goal }) => {
      updateDailyGoal(goal);
    }),
  );

  // Mood tracking operations
  ipcMain.handle(
    'mood:add',
    wrapStateMutation(async (_event, { mood, note }) => {
      addMoodEntry(mood, note);
    }),
  );

  ipcMain.handle('mood:getHistory', async () => {
    return getMoodHistory();
  });

  // Pomodoro operations
  ipcMain.handle(
    'pomodoro:addSession',
    wrapStateMutation(async (_event, { duration, articleId, sectionType }) => {
      addPomodoroSession(duration, articleId, sectionType);
    }),
  );

  ipcMain.handle('pomodoro:getStats', async () => {
    return getPomodoroStats();
  });

  // Theme operations
  ipcMain.handle('theme:get', async () => {
    return getTheme();
  });

  ipcMain.handle(
    'theme:set',
    wrapStateMutation(async (_event, { theme }) => {
      setTheme(theme);
    }),
  );

  // Writing stats
  ipcMain.handle('stats:get', async () => {
    return getWritingStats();
  });

  // Citation operations
  ipcMain.handle(
    'citation:add',
    wrapStateMutation(async (_event, { articleId, citation }) => {
      addCitation(articleId, citation);
    }),
  );
  ipcMain.handle(
    'citation:update',
    wrapStateMutation(async (_event, { articleId, citationId, patch }) => {
      updateCitation(articleId, citationId, patch);
    }),
  );
  ipcMain.handle(
    'citation:delete',
    wrapStateMutation(async (_event, { articleId, citationId }) => {
      deleteCitation(articleId, citationId);
    }),
  );

  // Tag operations
  ipcMain.handle(
    'tag:add',
    wrapStateMutation(async (_event, { articleId, tagName, tagColor }) => {
      addTag(articleId, tagName, tagColor);
    }),
  );

  ipcMain.handle(
    'tag:remove',
    wrapStateMutation(async (_event, { articleId, tagId }) => {
      removeTag(articleId, tagId);
    }),
  );

  // Export operations
  ipcMain.handle('export:html', async (_event, { articleId }) => {
    try {
      const exportPath = exportToHTML(articleId);
      await shell.showItemInFolder(exportPath);
      return exportPath;
    } catch (error) {
      console.error('Export HTML failed:', error);
      throw error;
    }
  });

  ipcMain.handle('export:json', async (_event, { articleId }) => {
    try {
      const exportPath = exportToJSON(articleId);
      await shell.showItemInFolder(exportPath);
      return exportPath;
    } catch (error) {
      console.error('Export JSON failed:', error);
      throw error;
    }
  });

  ipcMain.handle('export:share', async (_event, { articleId }) => {
    try {
      const shareDir = createSharePackage(articleId);
      await shell.showItemInFolder(shareDir);
      return shareDir;
    } catch (error) {
      console.error('Create share package failed:', error);
      throw error;
    }
  });

  // ---------- LLM provider management ----------
  const { PRESETS } = require('./llmPresets.cjs');

  function enrichProviders() {
    const { providers, activeId } = listProviders();
    return {
      providers: providers.map((p) => ({ ...p, hasApiKey: llmKeyStore.hasKey(p.id) })),
      activeId,
      presets: PRESETS,
    };
  }

  ipcMain.handle('llm:listProviders', async () => enrichProviders());

  ipcMain.handle('llm:addProvider', wrapMutation(async (_event, { draft }) => {
    const { apiKey, ...meta } = draft || {};
    const provider = addProviderStorage(meta);
    if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
      try {
        llmKeyStore.setKey(provider.id, apiKey.trim());
      } catch (error) {
        console.warn('Failed to save API key:', error.message);
      }
    }
    return enrichProviders();
  }));

  ipcMain.handle('llm:updateProvider', wrapMutation(async (_event, { id, patch }) => {
    const { apiKey, ...meta } = patch || {};
    let savedApiKey = false;
    if (typeof apiKey === 'string' && apiKey.trim()) {
      try {
        llmKeyStore.setKey(id, apiKey.trim());
        savedApiKey = true;
      } catch (error) {
        console.warn('Failed to save API key:', error.message);
      }
    }
    const storagePatch = savedApiKey ? { ...meta, activate: true } : meta;
    if (Object.keys(storagePatch).length > 0) {
      updateProviderStorage(id, storagePatch);
    }
    return enrichProviders();
  }));

  ipcMain.handle('llm:deleteProvider', wrapMutation(async (_event, { id }) => {
    deleteProviderStorage(id);
    try { llmKeyStore.deleteKey(id); } catch {}
    return enrichProviders();
  }));

  ipcMain.handle('llm:setActiveProvider', wrapMutation(async (_event, { id }) => {
    setActiveProviderStorage(id);
    return enrichProviders();
  }));

  ipcMain.handle('llm:testProvider', async (_event, { id }) => {
    return llmClient.testProvider(id);
  });

  // ---------- LLM chat ----------
  ipcMain.handle('llm:startChat', async (event, params) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
    const { activeId } = listProviders();
    if (!activeId) {
      return { ok: false, error: '未设置活跃 Provider' };
    }
    return llmClient.startChat({ ...params, providerId: activeId, mainWindow: win });
  });

  ipcMain.handle('llm:cancelSession', async (_event, { sessionId }) => {
    llmClient.cancelSession(sessionId);
  });

  ipcMain.handle('llm:approve', async (_event, { sessionId, callId, approved, alwaysAllow }) => {
    llmClient.resolveApproval(sessionId, callId, approved, alwaysAllow);
  });

  ipcMain.handle('scenario:list', () => listWritingScenarios());
  ipcMain.handle('scenario:add', wrapMutation((_event, { draft }) => addWritingScenario(draft)));
  ipcMain.handle('scenario:update', wrapMutation((_event, { id, patch }) => updateWritingScenario(id, patch)));
  ipcMain.handle('scenario:delete', wrapMutation((_event, { id }) => deleteWritingScenario(id)));
  ipcMain.handle('scenario:reset', wrapMutation((_event, { id }) => resetWritingScenarioToDefault(id)));
  ipcMain.handle('italic:get', () => getItalicGuide());
  ipcMain.handle('italic:set', wrapMutation((_event, { config }) => setItalicGuide(config)));
  ipcMain.handle('zotero:getConfig', () => getZoteroConfig());
  ipcMain.handle('zotero:setConfig', wrapMutation((_event, { config }) => setZoteroConfig(config)));

  // Custom autocomplete vocabulary — user-defined words & phrases that merge
  // into the immersive editor's autocomplete suggestions on the `general`
  // bucket. Also exposed via MCP write tools (toolRouter).
  ipcMain.handle('vocab:get', () => getCustomVocab());
  ipcMain.handle('vocab:addWord', wrapMutation((_event, { word }) => addCustomVocabWord(word)));
  ipcMain.handle('vocab:removeWord', wrapMutation((_event, { word }) => removeCustomVocabWord(word)));
  ipcMain.handle('vocab:addPhrase', wrapMutation((_event, { entry }) => addCustomVocabPhrase(entry)));
  ipcMain.handle('vocab:removePhrase', wrapMutation((_event, { trigger, text }) => removeCustomVocabPhrase(trigger, text)));
  ipcMain.handle('vocab:clear', wrapMutation(() => clearCustomVocab()));

  // Vocab pack registry — list + enable/disable + import/delete/rename
  ipcMain.handle('vocabPacks:list', () => listVocabPacks());
  ipcMain.handle('vocabPacks:setEnabled', wrapMutation((_event, { id, enabled }) => setVocabPackEnabled(id, enabled)));
  ipcMain.handle('vocabPacks:import', wrapMutation((_event, { pack }) => importVocabPack(pack)));
  ipcMain.handle('vocabPacks:delete', wrapMutation((_event, { id }) => deleteCustomVocabPack(id)));
  ipcMain.handle('vocabPacks:rename', wrapMutation((_event, { id, name }) => renameCustomVocabPack(id, name)));
  ipcMain.handle('vocabPacks:getCustom', () => getCustomVocabPacks());

  // User profile (display name shown in sidebar + greetings)
  ipcMain.handle('user:getProfile', () => getUserProfile());
  ipcMain.handle('user:setProfile', wrapStateMutation(async (_event, { patch }) => {
    setUserProfile(patch);
  }));
  ipcMain.handle('autoApprove:get', () => getAutoApproveTools());
  ipcMain.handle('autoApprove:set', wrapMutation((_event, { value }) => setAutoApproveTools(value)));

  // Progress entries / Findings / Daily session
  ipcMain.handle(
    'progress:add',
    wrapStateMutation(async (_event, { payload }) => addProgressEntry(payload, 'user')),
  );
  ipcMain.handle(
    'progress:update',
    wrapStateMutation(async (_event, { entryId, patch }) => updateProgressEntry(entryId, patch)),
  );
  ipcMain.handle(
    'progress:delete',
    wrapStateMutation(async (_event, { entryId }) => deleteProgressEntry(entryId)),
  );
  ipcMain.handle('progress:list', (_event, { filter }) => listProgressEntries(filter || {}));
  ipcMain.handle(
    'progress:link',
    wrapStateMutation(async (_event, { entryId, findingId }) => linkProgressEntryToFinding(entryId, findingId)),
  );
  ipcMain.handle(
    'finding:add',
    wrapStateMutation(async (_event, { articleId, sectionType, payload }) => addFinding(articleId, sectionType, payload)),
  );
  ipcMain.handle(
    'finding:update',
    wrapStateMutation(async (_event, { articleId, findingId, patch }) => updateFinding(articleId, findingId, patch)),
  );
  ipcMain.handle(
    'finding:delete',
    wrapStateMutation(async (_event, { articleId, findingId }) => deleteFinding(articleId, findingId)),
  );
  ipcMain.handle('finding:list', (_event, { articleId, sectionType }) => listFindings(articleId, sectionType));
  ipcMain.handle(
    'daily:start',
    wrapStateMutation(async (_event, { date, planText }) => startDailySession(date, planText)),
  );
  ipcMain.handle(
    'daily:setPlan',
    wrapStateMutation(async (_event, { date, planText }) => setDailyPlan(date, planText)),
  );
  ipcMain.handle(
    'daily:end',
    wrapStateMutation(async (_event, { date, summaryText }) => endDailySession(date, summaryText)),
  );
  ipcMain.handle('daily:get', (_event, { date }) => getDailySession(date));
}

async function startApplication() {
  app.setName('SciPaper Todo');

  if (isMcpMode) {
    await startMcpServer();
    return;
  }

  loadState();
  registerIpc();
  startDatabaseWatch();
  configureApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

app.whenReady().then(startApplication).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isMcpMode) {
    app.quit();
  }
});

app.on('before-quit', () => {
  fs.unwatchFile(DATABASE_PATH);
});
