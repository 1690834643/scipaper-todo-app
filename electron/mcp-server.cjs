const z = require('zod/v4');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { TOOLS } = require('./llmTools.cjs');
const { runTool } = require('./toolRouter.cjs');
const { localIsoDate } = require('./dateUtils.cjs');
const {
  getArticleById,
  getMcpResourceOverview,
  getSectionByArticle,
  loadState,
  getDailySession,
} = require('./storage.cjs');

const SECTION_ALIASES = {
  title: 'Title',
  abstract: 'Abstract',
  introduction: 'Introduction',
  methods: 'MaterialsAndMethods',
  results: 'Results',
  discussion: 'Discussion',
  references: 'References',
};

function normalizeSection(section) {
  return SECTION_ALIASES[section] || section;
}

function asJsonContent(uri, payload) {
  return {
    contents: [
      {
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function withSchemaDescription(zodSchema, jsonSchema) {
  return jsonSchema.description ? zodSchema.describe(jsonSchema.description) : zodSchema;
}

function enumToZod(values) {
  if (values.length > 0 && values.every((value) => typeof value === 'string')) {
    return z.enum(values);
  }

  return z.string().refine((value) => values.includes(value), {
    message: `Expected one of: ${values.join(', ')}`,
  });
}

function jsonSchemaToZod(jsonSchema = {}) {
  let zodSchema;

  if (Array.isArray(jsonSchema.enum)) {
    zodSchema = enumToZod(jsonSchema.enum);
  } else if (jsonSchema.type === 'string') {
    zodSchema = z.string();
  } else if (jsonSchema.type === 'number') {
    zodSchema = z.number();
  } else if (jsonSchema.type === 'integer') {
    zodSchema = z.number().int();
  } else if (jsonSchema.type === 'boolean') {
    zodSchema = z.boolean();
  } else if (jsonSchema.type === 'array') {
    zodSchema = z.array(z.any());
  } else if (jsonSchema.type === 'object' || jsonSchema.properties) {
    const required = new Set(jsonSchema.required || []);
    const shape = {};

    for (const [fieldName, fieldSchema] of Object.entries(jsonSchema.properties || {})) {
      let zodField = jsonSchemaToZod(fieldSchema);

      if (!required.has(fieldName)) {
        zodField = zodField.optional();
      }

      shape[fieldName] = zodField;
    }

    zodSchema = z.object(shape);

    if (jsonSchema.additionalProperties === false) {
      zodSchema = zodSchema.strict();
    }
  } else {
    zodSchema = z.any();
  }

  return withSchemaDescription(zodSchema, jsonSchema);
}

function buildTodayInbox() {
  const today = localIsoDate();
  const state = loadState();
  const session = getDailySession(today);
  const todayEntries = (state.progressEntries || []).filter((e) => e.date === today);
  const moods = state.writingStreak?.moodHistory ?? [];
  const todayMood = moods.find((m) => m.date === today) || null;
  const todayPomos = (state.pomodoroStats?.todaySessions ?? 0);
  const focusMin = (state.pomodoroStats?.todayMinutes ?? 0);

  const todoChecklist = [];
  if (!session?.planText) todoChecklist.push('设今天的 plan（用 set_daily_plan）');
  if (!todayMood) todoChecklist.push('记一下当前心情（用 add_mood_entry）');
  if (todoChecklist.length === 0 || todayPomos === 0) todoChecklist.push('开一段番茄钟，结束后 add_pomodoro_session');
  if (todayEntries.length < 3) todoChecklist.push('写几条今日时间线（add_progress_entry，kind: read/experiment/idea/cite/analysis）');
  if (!session?.summaryText) todoChecklist.push('日终前 end_daily_session 写收尾总结');

  return {
    date: today,
    plan: session?.planText || null,
    summary: session?.summaryText || null,
    mood: todayMood ? { mood: todayMood.mood, note: todayMood.note || null } : null,
    pomodoro: { sessions: todayPomos, focusMinutes: focusMin },
    progressEntriesCount: todayEntries.length,
    progressEntriesByKind: todayEntries.reduce((acc, e) => {
      acc[e.kind] = (acc[e.kind] || 0) + 1
      return acc
    }, {}),
    writingTodayWords: state.writingStreak?.todayWords ?? 0,
    suggestions: todoChecklist,
  };
}

async function startMcpServer() {
  const server = new McpServer({
    name: 'scipaper-todo',
    version: '1.0.0',
    instructions: [
      'SciPaper Todo MCP server. 你接管的是一位科研工作者的日常论文工作台。',
      '',
      '每次会话开始时，建议先读 `scipaper://today/inbox` 资源，看看今天哪些"轨道"还没填——plan / 心情 / 番茄钟 / 进展条目 / 收尾总结。',
      '',
      '可写的工具（请优先帮用户填这些）：',
      '- set_daily_plan: 写今天计划',
      '- end_daily_session: 写收尾总结',
      '- add_mood_entry: 记心情（10 个 mood 之一 + 可选 note）',
      '- add_pomodoro_session: 记一段已完成的专注（duration 分钟）',
      '- add_progress_entry: 写一条今日时间线条目（kind: read/experiment/writing/idea/cite/analysis）',
      '',
      '配套的写作 / 引文 / 评审工具按文章 id 分组，详见各 tool description。',
    ].join('\n'),
  });

  server.registerResource(
    'today-inbox',
    'scipaper://today/inbox',
    {
      title: "Today's Inbox",
      description: '今天的状态摘要：plan、心情、番茄钟、进展条目、收尾总结，以及还缺什么的建议。',
      mimeType: 'application/json',
    },
    async (uri) => asJsonContent(uri, buildTodayInbox()),
  );

  server.registerResource(
    'article-overview',
    new ResourceTemplate('scipaper://article/{articleId}/overview', { list: undefined }),
    {
      title: 'Article Overview',
      description: '获取文章全景信息',
      mimeType: 'application/json',
    },
    async (uri, { articleId }) => asJsonContent(uri, getMcpResourceOverview(getArticleById(articleId))),
  );

  server.registerResource(
    'article-research-context',
    new ResourceTemplate('scipaper://article/{articleId}/research-context', { list: undefined }),
    {
      title: 'Research Context',
      description: '获取研究上下文',
      mimeType: 'application/json',
    },
    async (uri, { articleId }) => asJsonContent(uri, getArticleById(articleId).researchContext),
  );

  server.registerResource(
    'article-pending-reviews',
    new ResourceTemplate('scipaper://article/{articleId}/pending-reviews', { list: undefined }),
    {
      title: 'Pending Reviews',
      description: '获取待处理审稿意见',
      mimeType: 'application/json',
    },
    async (uri, { articleId }) =>
      asJsonContent(
        uri,
        getArticleById(articleId).reviewRounds.flatMap((round) =>
          round.comments
            .filter((comment) => comment.status !== 'Completed')
            .map((comment) => ({
              round: round.roundNumber,
              ...comment,
            })),
        ),
      ),
  );

  server.registerResource(
    'article-citations',
    new ResourceTemplate('scipaper://article/{articleId}/citations', { list: undefined }),
    {
      title: 'Citations',
      description: '获取参考文献列表',
      mimeType: 'application/json',
    },
    async (uri, { articleId }) => asJsonContent(uri, getArticleById(articleId).citations),
  );

  server.registerResource(
    'article-section',
    new ResourceTemplate('scipaper://article/{articleId}/section/{section}', { list: undefined }),
    {
      title: 'Section Content',
      description: '获取特定章节内容',
      mimeType: 'application/json',
    },
    async (uri, { articleId, section }) => asJsonContent(uri, getSectionByArticle(articleId, normalizeSection(section))),
  );

  // 安全：MCP 通道下没有 approval dialog，外部客户端可任意调写工具。
  // 默认只暴露读工具；写工具需用户显式设置 SCIPAPER_MCP_ALLOW_WRITE=1 才注册。
  const allowWrite = process.env.SCIPAPER_MCP_ALLOW_WRITE === '1';
  let registeredCount = 0;
  let skippedWrites = 0;
  for (const tool of TOOLS) {
    if (tool.isWrite && !allowWrite) {
      skippedWrites += 1;
      continue;
    }
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: jsonSchemaToZod(tool.parameters),
      },
      async (args) => {
        const result = await runTool(tool.name, args);

        if (!result.ok) {
          return { content: [{ type: 'text', text: 'Tool error: ' + result.error }], isError: true };
        }

        return {
          content: [
            {
              type: 'text',
              text: typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2),
            },
          ],
        };
      },
    );
    registeredCount += 1;
  }
  if (!allowWrite && skippedWrites > 0) {
    console.error(
      `[scipaper-mcp] 跳过 ${skippedWrites} 个写工具（默认只读模式）。` +
        ' 设 SCIPAPER_MCP_ALLOW_WRITE=1 启用写入。',
    );
  }
  console.error(`[scipaper-mcp] 已注册 ${registeredCount} 个工具${allowWrite ? '（含写）' : '（仅读）'}。`);

  server.registerPrompt(
    'generate-outline',
    {
      description: '基于 ResearchContext 生成论文大纲建议',
      argsSchema: {
        article_id: z.string(),
      },
    },
    async ({ article_id }) => {
      const article = getArticleById(article_id);

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `请基于以下信息输出这篇生命科学论文的 IMRaD 大纲建议：\n标题：${article.title}\n科学问题：${article.researchContext.scientificQuestion}\n观察现象：${article.researchContext.observedPhenomenon}\n假设：${article.researchContext.hypothesis}\n方案：${article.researchContext.approach}`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    'analyze-results',
    {
      description: '分析 Results 内容并建议 Discussion 写作方向',
      argsSchema: {
        article_id: z.string(),
      },
    },
    async ({ article_id }) => {
      const results = getSectionByArticle(article_id, 'Results');

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `请根据下面的 Results 内容，给出 Discussion 的写作方向与结构建议：\n${JSON.stringify(results, null, 2)}`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    'draft-response-letter',
    {
      description: '根据修改记录生成回复信草稿',
      argsSchema: {
        article_id: z.string(),
        round: z.number(),
      },
    },
    async ({ article_id, round }) => {
      const article = getArticleById(article_id);
      const roundRecord = article.reviewRounds.find((item) => item.roundNumber === round);

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `请根据以下第 ${round} 轮审稿记录，生成礼貌、逐条对应的回复信草稿：\n${JSON.stringify(roundRecord, null, 2)}`,
            },
          },
        ],
      };
    },
  );

  server.registerPrompt(
    'today-checkin',
    {
      description: '把今天还缺的几条（plan / 心情 / 番茄钟 / 进展条目 / 收尾总结）一次性问出来，让 LLM 帮用户填。',
      argsSchema: {},
    },
    async () => {
      const inbox = buildTodayInbox();
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                '今天的状态：',
                JSON.stringify(inbox, null, 2),
                '',
                '请按下面顺序帮我把今天填起来：',
                '1. 如果 plan 为空 → 问我今天打算做什么，然后用 set_daily_plan 写下。',
                '2. 如果 mood 为空 → 问我现在心情怎么样，从 Happy/Calm/Excited/Motivated/Grateful/Tired/Sad/Frustrated/Anxious/Melancholy 选一个，可以加一句话 note，然后用 add_mood_entry。',
                '3. 如果今天还没番茄钟（pomodoro.sessions=0）→ 提醒我开一段，做完用 add_pomodoro_session 记下。',
                '4. progressEntries 少于 3 条 → 引导我写几条今日时间线（read/experiment/idea/cite/analysis），用 add_progress_entry。',
                '5. 临近收尾（如果用户说"今天就这样了"或类似话）→ 用 end_daily_session 写收尾总结。',
                '',
                '一次只问一件事，按顺序来。已经填好的别重复问。',
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

module.exports = {
  startMcpServer,
};
