const fs = require('fs');
const os = require('os');
const path = require('path');
const storage = require('./storage.cjs');
const { TOOLS } = require('./llmTools.cjs');
const zoteroClient = require('./zoteroClient.cjs');

// 安全：attach_file 接受任意 sourcePath（绝对路径）→ 历史无校验，LLM/MCP 输入可读取
// 系统配置/凭据。这里限制为用户家目录、/tmp、WSL /mnt/<drive>/ 下，且拒绝典型敏感子目录。
// 同时匹配 / 与 \\ 分隔符，覆盖 Windows 路径（review-05 报告：之前正则只
// 含 / 在 Windows 上敏感目录会被绕过）。统一用 [\\\\/]+ 而非 split + join。
const ATTACH_DENY_PATTERNS = [
  /(^|[\\/])\.ssh([\\/]|$)/i,
  /(^|[\\/])\.aws([\\/]|$)/i,
  /(^|[\\/])\.azure([\\/]|$)/i,
  /(^|[\\/])\.gnupg([\\/]|$)/i,
  /(^|[\\/])\.netrc$/i,
  /(^|[\\/])\.kube([\\/]|$)/i,
  /(^|[\\/])\.docker([\\/]|$)/i,
  /(^|[\\/])\.config[\\/]scipaper-todo([\\/]|$)/i,
];

function isAllowedAttachSource(sourcePath) {
  if (typeof sourcePath !== 'string' || !sourcePath) return false;
  if (!path.isAbsolute(sourcePath)) return false;
  const resolved = path.resolve(sourcePath);
  if (ATTACH_DENY_PATTERNS.some((re) => re.test(resolved))) return false;
  const allowedRoots = [
    os.homedir(),
    os.tmpdir(),
    '/mnt', // WSL Windows drives
    '/Volumes', // macOS external mounts
  ].filter(Boolean).map((root) => path.resolve(root));
  return allowedRoots.some((root) => {
    const rootSep = root.endsWith(path.sep) ? root : root + path.sep;
    return resolved === root || resolved.startsWith(rootSep);
  });
}

const ROUTER_ONLY_TOOLS = [
  {
    name: 'list_theses',
    storageCall: 'loadState',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
];

const READ_DISPATCH = {
  zotero_search_library: async (_fn, args) => zoteroClient.searchLibrary(args.query, args.limit),
  zotero_get_item_details: async (_fn, args) => zoteroClient.getItemDetails(args.itemKey),
  zotero_list_collections: async (_fn, _args) => zoteroClient.listCollections(),
  zotero_get_collection_items: async (_fn, args) => zoteroClient.getCollectionItems(args.collectionKey, args.limit),
  zotero_get_item_fulltext: async (_fn, args) => zoteroClient.getItemFulltext(args.itemKey),
  get_article: (fn, args) => fn(args.articleId),
  get_research_context: (fn, args) => fn(args.articleId).researchContext,
  list_citations: (fn, args) => fn(args.articleId).citations || [],
  list_pending_reviews: (fn, args) => {
    const article = fn(args.articleId);
    return (article.reviewRounds || []).flatMap((round) =>
      (round.comments || [])
        .filter((comment) => comment.status !== 'Completed')
        .map((comment) => ({
          roundId: round.id,
          roundNumber: round.roundNumber,
          commentId: comment.id,
          originalText: comment.originalText,
          type: comment.type,
          suggestedSection: comment.suggestedSection,
          status: comment.status,
        })),
    );
  },
  list_articles: (fn) =>
    (fn().articles || []).map((article) => ({
      id: article.id,
      title: article.title,
      targetJournal: article.targetJournal,
      status: article.status,
      sectionCount: (article.sections || []).length,
      citationCount: (article.citations || []).length,
      updatedAt: article.updatedAt,
    })),
  find_article: (fn, args) => {
    const query = String(args.query || '').toLowerCase().trim();
    const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 20;
    const all = fn().articles || [];
    const filtered = all.filter((article) => {
      if (args.status && article.status !== args.status) return false;
      if (!query) return true;
      const haystack = [article.title, article.targetJournal].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
    return filtered.slice(0, limit).map((article) => ({
      id: article.id,
      title: article.title,
      targetJournal: article.targetJournal,
      status: article.status,
      updatedAt: article.updatedAt,
    }));
  },
  list_sections: (fn, args) => {
    const article = fn(args.articleId);
    return (article.sections || []).map((section) => {
      const textBlocks = (section.contentBlocks || []).filter((block) => block.type === 'Text');
      const wordCount = textBlocks.reduce((sum, block) => sum + countWords(block.content || ''), 0);
      const lastUpdated = (section.contentBlocks || [])
        .map((block) => block.updatedAt)
        .filter(Boolean)
        .sort()
        .pop() || null;
      const firstSentence = (() => {
        const firstText = textBlocks.find((block) => (block.content || '').trim().length > 0);
        if (!firstText) return '';
        const trimmed = firstText.content.replace(/\s+/g, ' ').trim();
        const cut = trimmed.split(/(?<=[.!?。！？])\s/)[0] || trimmed;
        return cut.length > 160 ? cut.slice(0, 160) + '…' : cut;
      })();
      return {
        sectionId: section.id,
        sectionType: section.type,
        wordCount,
        blockCount: (section.contentBlocks || []).length,
        lastUpdated,
        firstSentence,
      };
    });
  },
  get_section_summary: (fn, args) => {
    const article = fn(args.articleId);
    const section = (article.sections || []).find((item) => item.type === args.sectionType);
    if (!section) throw new Error('Section not found: ' + args.sectionType);
    const textBlocks = (section.contentBlocks || []).filter((block) => block.type === 'Text');
    const joined = textBlocks.map((block) => block.content || '').join('\n\n').trim();
    const wordCount = textBlocks.reduce((sum, block) => sum + countWords(block.content || ''), 0);
    const head = joined.length > 280 ? joined.slice(0, 280) + '…' : joined;
    const tail = joined.length > 560 ? '…' + joined.slice(-280) : '';
    const lastUpdated = (section.contentBlocks || [])
      .map((block) => block.updatedAt)
      .filter(Boolean)
      .sort()
      .pop() || null;
    return {
      sectionId: section.id,
      sectionType: section.type,
      wordCount,
      blockCount: (section.contentBlocks || []).length,
      lastUpdated,
      head,
      tail,
    };
  },
  get_word_count: (fn, args) => {
    const state = fn();
    const articles = args.articleId
      ? (state.articles || []).filter((article) => article.id === args.articleId)
      : state.articles || [];
    const byArticle = articles.map((article) => ({
      id: article.id,
      title: article.title,
      count: countArticleWords(article),
    }));
    return { total: byArticle.reduce((total, article) => total + article.count, 0), byArticle };
  },
  list_theses: (fn) =>
    (fn().theses || []).map((thesis) => {
      const articles = thesis.articles || thesis.articleIds || [];
      return { id: thesis.id, title: thesis.title, status: thesis.status, articleCount: articles.length || 0 };
    }),
  get_writing_guidance: (fn, args) => fn(args.articleId, args.targetSection),
  list_progress_entries: (fn, args) => fn({
    articleId: args.articleId,
    date: args.date,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    kind: args.kind,
    findingId: args.findingId,
  }),
  list_findings: (fn, args) => fn(args.articleId, args.sectionType),
  get_daily_session: (fn, args) => fn(args.date),
  get_writing_streak: (fn) => fn().writingStreak,
  get_mood_history: (fn) => fn(),
  get_pomodoro_stats: (fn) => fn(),
  get_writing_stats: (fn) => fn(),
  get_theme: (fn) => fn(),
  list_scenarios: (fn) => fn(),
  get_italic_guide: (fn) => fn(),
  get_zotero_config: (fn) => fn(),
  get_auto_approve_tools: (fn) => fn(),
};

const WRITE_DISPATCH = {
  create_article: (fn, args) => fn(args),
  update_article_meta: (fn, args) => fn(args.articleId, args.patch),
  update_research_context: (fn, args) => fn(args.articleId, args.researchContext),
  add_text_block: (fn, args) => fn(args.articleId, args.sectionType, args.content, args.description, 'AI Co-write', 'ai'),
  update_text_block: (fn, args) => fn(args.articleId, args.blockId, args.content, args.description, 'AI Co-write', 'ai'),
  delete_block: (fn, args) => fn(args.articleId, args.blockId, 'ai'),
  add_citation: (fn, args) => fn(args.articleId, args.payload),
  add_review_round: (fn, args) => fn(args.articleId, args.payload),
  add_review_comment: (fn, args) => fn(args.articleId, args.roundId, args.payload),
  update_review_comment_status: (fn, args) => fn(args.articleId, args.roundId, args.commentId, args.status),
  add_revision: (fn, args) => fn(args.articleId, args.roundId, args.commentId, args.payload),
  add_tag: (fn, args) => fn(args.articleId, args.tagName, args.tagColor),
  remove_tag: (fn, args) => fn(args.articleId, args.tagId),
  create_thesis: (fn, args) => fn(args),
  link_article_to_thesis: (fn, args) => fn(args.thesisId, args.articleId),
  attach_file: (fn, args) => {
    if (!isAllowedAttachSource(args.sourcePath)) {
      throw new Error(
        'sourcePath 不在允许目录内（仅支持用户家目录 / 临时目录 / /mnt 或 /Volumes 挂载点，且排除 ~/.ssh、~/.aws 等敏感目录）：' + args.sourcePath,
      );
    }
    if (!fs.existsSync(args.sourcePath)) {
      throw new Error('Source file does not exist: ' + args.sourcePath);
    }
    fn(args.articleId, args.sectionType, args.kind, args.sourcePath, 'AI Co-write', args.description || '');
    return { ok: true, message: '已导入附件' };
  },
  add_progress_entry: (fn, args) => fn(args, 'ai'),
  update_progress_entry: (fn, args) => fn(args.entryId, args.patch),
  delete_progress_entry: (fn, args) => fn(args.entryId),
  link_progress_to_finding: (fn, args) => fn(args.entryId, args.findingId),
  add_finding: (fn, args) => fn(args.articleId, args.sectionType, args),
  update_finding: (fn, args) => fn(args.articleId, args.findingId, args.patch),
  delete_finding: (fn, args) => fn(args.articleId, args.findingId),
  start_daily_session: (fn, args) => fn(args.date, args.planText),
  set_daily_plan: (fn, args) => fn(args.date, args.planText),
  end_daily_session: (fn, args) => fn(args.date, args.summaryText),
  add_pomodoro_session: (fn, args) => fn(args.duration, args.articleId || '', args.sectionType || ''),
  add_mood_entry: (fn, args) => fn(args.mood, args.note || ''),
  update_daily_writing_goal: (fn, args) => fn(args.goal),
  set_theme: (fn, args) => fn(args.theme),
  set_auto_approve_tools: (fn, args) => fn(args.value),
  add_scenario: (fn, args) => fn(args),
  update_scenario: (fn, args) => fn(args.id, args.patch),
  delete_scenario: (fn, args) => fn(args.id),
  reset_scenario: (fn, args) => fn(args.id),
  set_italic_guide: (fn, args) => fn(args),
  set_zotero_config: (fn, args) => fn(args),
  update_thesis_meta: (fn, args) => fn(args.thesisId, args.patch),
  add_thesis_section: (fn, args) => fn(args.thesisId, args.sectionType, args.title),
  unlink_article_from_thesis: (fn, args) => fn(args.thesisId, args.articleId),
  export_article: async (_fn, args) => {
    const { articleId, format } = args;
    switch (format) {
      case 'markdown':
        return { format, path: storage.exportMarkdown(articleId) };
      case 'html':
        return { format, path: storage.exportToHTML(articleId) };
      case 'json':
        return { format, path: storage.exportToJSON(articleId) };
      case 'share':
        return { format, path: storage.createSharePackage(articleId) };
      case 'docx': {
        const { exportArticleDocx } = require('./docxExporter.cjs');
        const out = await exportArticleDocx(articleId, args.docxTemplate || 'academic-en', {
          applyItalicGuide: !!args.applyItalicGuide,
        });
        return { format, path: out };
      }
      case 'latex': {
        const { exportArticleLatex } = require('./latexExporter.cjs');
        return { format, path: exportArticleLatex(articleId) };
      }
      default:
        throw new Error('unknown export format: ' + format);
    }
  },
};

function findTool(name) {
  return TOOLS.find((entry) => entry.name === name) || ROUTER_ONLY_TOOLS.find((entry) => entry.name === name);
}

function normalizeArgs(args) {
  return args && typeof args === 'object' && !Array.isArray(args) ? args : {};
}

function countArticleWords(article) {
  return (article.sections || []).reduce(
    (sectionTotal, section) =>
      sectionTotal +
      (section.contentBlocks || []).reduce(
        (blockTotal, block) => blockTotal + (block.type === 'Text' ? countWords(block.content) : 0),
        0,
      ),
    0,
  );
}

function countWords(text) {
  if (typeof text !== 'string') return 0;
  return (text.match(/[\u4e00-\u9fa5]/g) || []).length + (text.match(/[a-zA-Z]+/g) || []).length;
}

function typeMatches(value, expected) {
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (['string', 'number', 'boolean'].includes(expected)) return typeof value === expected;
  return true;
}

function validateArgs(name, args) {
  const tool = findTool(name);
  if (!tool) return { valid: false, errors: ['unknown tool'] };

  const schema = tool.parameters;
  const input = normalizeArgs(args);
  const errors = [];
  if (!schema || schema.type !== 'object') return { valid: true, errors };

  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const key of Object.keys(properties)) {
    const value = input[key];
    const property = properties[key] || {};

    if (required.includes(key) && value === undefined) {
      errors.push('missing required: ' + key);
      continue;
    }
    if (value === undefined) continue;
    if (property.type && !typeMatches(value, property.type)) {
      errors.push('invalid type for ' + key + ': expected ' + property.type);
    }
    if (property.enum && !property.enum.includes(value)) {
      errors.push('invalid enum for ' + key + ': ' + value);
    }
  }

  if (schema.additionalProperties === false) {
    // schema 明确禁止未知字段 → 必须 fail，否则旧 schema 调用（如 LLM 用旧版
    // background/objectives/keyMethods 调 update_research_context）会 silent
    // no-op，AI 还以为操作成功。
    for (const key of Object.keys(input)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) {
        errors.push('unknown property: ' + key);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

async function runTool(name, args) {
  const tool = findTool(name);
  const input = normalizeArgs(args);
  if (!tool) return { ok: false, error: 'unknown_tool: ' + name };

  const validation = validateArgs(name, input);
  if (!validation.valid) return { ok: false, error: 'validation: ' + validation.errors.join(', ') };

  try {
    if (tool.storageCall === '__zotero__') {
      const dispatch = READ_DISPATCH[name];
      if (!dispatch) throw new Error('no router dispatch for tool: ' + name);

      const result = await dispatch(null, input);
      return result && typeof result === 'object' && typeof result.ok === 'boolean' ? result : { ok: true, result };
    }

    if (tool.storageCall === '__exporter__') {
      const dispatch = WRITE_DISPATCH[name];
      if (!dispatch) throw new Error('no router dispatch for tool: ' + name);

      const result = await dispatch(null, input);
      return result && typeof result === 'object' && typeof result.ok === 'boolean' ? result : { ok: true, result };
    }

    const storageFn = storage[tool.storageCall];
    if (typeof storageFn !== 'function') throw new Error('storage function not found: ' + tool.storageCall);

    // Dispatch tables keep read derivations separate from write argument mapping.
    const dispatch = READ_DISPATCH[name] || WRITE_DISPATCH[name];
    if (!dispatch) throw new Error('no router dispatch for tool: ' + name);

    const result = await dispatch(storageFn, input);
    const normalized = WRITE_DISPATCH[name] && result == null ? { ok: true, message: '已执行' } : result;
    return { ok: true, result: normalized };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function summarizeForApproval(name, args) {
  const input = normalizeArgs(args);

  switch (name) {
    case 'create_article': return '创建论文项目：' + (input.title || '未命名研究');
    case 'update_article_meta': return '更新论文元信息：' + input.articleId;
    case 'update_research_context': return '更新论文研究上下文：' + input.articleId;
    case 'add_text_block': return '向论文 ' + input.articleId + ' 的 ' + input.sectionType + ' 章节添加文本块';
    case 'update_text_block': return '更新论文 ' + input.articleId + ' 的文本块 ' + input.blockId;
    case 'delete_block': return '删除论文 ' + input.articleId + ' 的内容块 ' + input.blockId;
    case 'add_citation': return '向论文 ' + input.articleId + ' 添加参考文献';
    case 'add_review_round': return '向论文 ' + input.articleId + ' 添加审稿轮次';
    case 'add_review_comment': return '向审稿轮次 ' + input.roundId + ' 添加审稿意见';
    case 'update_review_comment_status': return '将审稿意见 ' + input.commentId + ' 状态更新为 ' + input.status;
    case 'add_revision': return '为审稿意见 ' + input.commentId + ' 添加修回记录';
    case 'add_tag': return '给论文 ' + input.articleId + ' 添加标签：' + input.tagName;
    case 'remove_tag': return '从论文 ' + input.articleId + ' 移除标签：' + input.tagId;
    case 'create_thesis': return '创建学位论文项目：' + (input.title || '未命名论文');
    case 'link_article_to_thesis': return '把论文 ' + input.articleId + ' 关联到学位论文 ' + input.thesisId;
    case 'attach_file': return '导入文件到论文 ' + input.articleId + ' 的 ' + input.sectionType + '：' + (input.sourcePath || '');
    case 'find_article': return '查找论文：' + (input.query || '');
    case 'list_sections': return '列出论文章节摘要：' + input.articleId;
    case 'get_section_summary': return '读取章节摘要：' + input.articleId + ' / ' + input.sectionType;
    case 'add_progress_entry': return '新增进展条目（' + (input.kind || '?') + '）：' + (input.title || '');
    case 'list_progress_entries': return '查询进展条目';
    case 'update_progress_entry': return '更新进展条目：' + input.entryId;
    case 'delete_progress_entry': return '删除进展条目：' + input.entryId;
    case 'link_progress_to_finding': return '把进展 ' + input.entryId + ' 关联到 finding ' + input.findingId;
    case 'add_finding': return '在论文 ' + input.articleId + ' 的 ' + input.sectionType + ' 新增 finding：' + (input.title || '');
    case 'list_findings': return '列出 findings：' + input.articleId;
    case 'update_finding': return '更新 finding：' + input.findingId;
    case 'delete_finding': return '删除 finding：' + input.findingId;
    case 'start_daily_session': return '开启工作 session：' + (input.date || 'today');
    case 'set_daily_plan': return '设置今日 plan';
    case 'end_daily_session': return '结束工作 session';
    case 'get_daily_session': return '读取工作 session：' + (input.date || 'today');
    case 'get_article': return '读取论文完整记录：' + input.articleId;
    case 'list_articles': return '列出所有论文项目';
    case 'list_theses': return '列出所有学位论文项目';
    case 'get_research_context': return '读取论文研究上下文：' + input.articleId;
    case 'list_citations': return '列出论文参考文献：' + input.articleId;
    case 'list_pending_reviews': return '列出论文未完成审稿意见：' + input.articleId;
    case 'get_word_count': return input.articleId ? '统计论文 ' + input.articleId + ' 的字数' : '统计全局字数';
    case 'get_writing_guidance': return '获取论文 ' + input.articleId + ' 的 ' + input.targetSection + ' 写作建议';
    case 'export_article': return '导出论文 ' + input.articleId + ' 为 ' + input.format + (input.docxTemplate ? '（模板：' + input.docxTemplate + '）' : '');
    case 'get_writing_streak': return '读取写作 streak 状态';
    case 'update_daily_writing_goal': return '设置每日写作字数目标：' + input.goal;
    case 'get_mood_history': return '读取心情历史';
    case 'get_pomodoro_stats': return '读取番茄钟统计';
    case 'get_writing_stats': return '读取写作统计';
    case 'get_theme': return '读取当前主题';
    case 'set_theme': return '切换主题为：' + input.theme;
    case 'get_auto_approve_tools': return '读取「AI 自动批准工具调用」开关';
    case 'set_auto_approve_tools': return '设置「AI 自动批准工具调用」为：' + (input.value ? '开启' : '关闭');
    case 'list_scenarios': return '列出写作场景预设';
    case 'add_scenario': return '新增写作场景：' + (input.name || '');
    case 'update_scenario': return '更新写作场景：' + input.id;
    case 'delete_scenario': return '删除写作场景：' + input.id;
    case 'reset_scenario': return '重置 builtin 写作场景：' + input.id;
    case 'get_italic_guide': return '读取斜体规范配置';
    case 'set_italic_guide': return '设置斜体规范' + (typeof input.enabled === 'boolean' ? '（enabled=' + input.enabled + '）' : '');
    case 'get_zotero_config': return '读取 Zotero 配置';
    case 'set_zotero_config': return '设置 Zotero 配置';
    case 'update_thesis_meta': return '更新学位论文元信息：' + input.thesisId;
    case 'add_thesis_section': return '为学位论文 ' + input.thesisId + ' 新增 section：' + input.sectionType;
    case 'unlink_article_from_thesis': return '把论文 ' + input.articleId + ' 从学位论文 ' + input.thesisId + ' 解关联';
    case 'add_pomodoro_session': return '记录番茄钟（' + (input.duration || '?') + ' 分钟）';
    case 'add_mood_entry': return '记心情：' + (input.mood || '?');
    default: return '执行工具调用：' + name;
  }
}

module.exports = { runTool, validateArgs, summarizeForApproval };
