const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const {
  addAssetBlock,
  addAnnotation,
  updateAnnotation,
  deleteAnnotation,
  addReviewComment,
  DATABASE_PATH,
  addReviewRound,
  addRevision,
  addTextBlock,
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
  createThesis,
  updateThesisMeta,
  addThesisSection,
  linkArticleToThesis,
  unlinkArticleFromThesis,
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
  addTag,
  removeTag,
  exportToHTML,
  exportToJSON,
  createSharePackage,
  listWritingScenarios,
  addWritingScenario,
  updateWritingScenario,
  deleteWritingScenario,
  resetWritingScenarioToDefault,
  getItalicGuide,
  setItalicGuide,
  getZoteroConfig,
  setZoteroConfig,
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

function wrapStateMutation(handler) {
  return async (...args) => {
    await handler(...args);
    return loadState();
  };
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

  ipcMain.handle(
    'article:create',
    wrapStateMutation(async (_event, payload) => {
      createArticle(payload);
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
    'review:updateCommentStatus',
    wrapStateMutation(async (_event, { articleId, roundId, commentId, status }) => {
      updateReviewCommentStatus(articleId, roundId, commentId, status);
    }),
  );
  ipcMain.handle(
    'review:addRevision',
    wrapStateMutation(async (_event, { articleId, roundId, commentId, payload }) => {
      addRevision(articleId, roundId, commentId, payload);
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

  ipcMain.handle('llm:addProvider', async (_event, { draft }) => {
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
  });

  ipcMain.handle('llm:updateProvider', async (_event, { id, patch }) => {
    const { apiKey, ...meta } = patch || {};
    if (Object.keys(meta).length > 0) {
      updateProviderStorage(id, meta);
    }
    if (typeof apiKey === 'string' && apiKey.trim()) {
      try {
        llmKeyStore.setKey(id, apiKey.trim());
      } catch (error) {
        console.warn('Failed to save API key:', error.message);
      }
    }
    return enrichProviders();
  });

  ipcMain.handle('llm:deleteProvider', async (_event, { id }) => {
    deleteProviderStorage(id);
    try { llmKeyStore.deleteKey(id); } catch {}
    return enrichProviders();
  });

  ipcMain.handle('llm:setActiveProvider', async (_event, { id }) => {
    setActiveProviderStorage(id);
    return enrichProviders();
  });

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
  ipcMain.handle('scenario:add', (_, { draft }) => addWritingScenario(draft));
  ipcMain.handle('scenario:update', (_, { id, patch }) => updateWritingScenario(id, patch));
  ipcMain.handle('scenario:delete', (_, { id }) => deleteWritingScenario(id));
  ipcMain.handle('scenario:reset', (_, { id }) => resetWritingScenarioToDefault(id));
  ipcMain.handle('italic:get', () => getItalicGuide());
  ipcMain.handle('italic:set', (_, { config }) => setItalicGuide(config));
  ipcMain.handle('zotero:getConfig', () => getZoteroConfig());
  ipcMain.handle('zotero:setConfig', (_, { config }) => setZoteroConfig(config));
  ipcMain.handle('autoApprove:get', () => getAutoApproveTools());
  ipcMain.handle('autoApprove:set', (_, { value }) => setAutoApproveTools(value));

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
