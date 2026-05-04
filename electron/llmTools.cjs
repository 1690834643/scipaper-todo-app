const SECTION_TYPE_ENUM = [
  'Title',
  'Abstract',
  'Introduction',
  'MaterialsAndMethods',
  'Results',
  'Discussion',
  'References',
  'Acknowledgments',
  'Figures',
  'Tables',
  'SupplementaryMaterials',
];

const ARTICLE_STATUS_ENUM = [
  'Drafting',
  'Submitted',
  'UnderReview',
  'Revision',
  'Resubmitted',
  'Accepted',
  'Rejected',
  'Published',
];

const REVIEW_COMMENT_TYPE_ENUM = ['Major', 'Minor'];
const REVIEW_COMMENT_STATUS_ENUM = ['Pending', 'InProgress', 'Completed'];
const THESIS_STATUS_ENUM = ['Proposal', 'InProgress', 'DefenseReady', 'Defended', 'Revised', 'Final'];
const DEGREE_TYPE_ENUM = ['Master', 'PhD'];
const PROGRESS_KIND_ENUM = ['read', 'experiment', 'writing', 'idea', 'cite', 'analysis', 'focus', 'mood'];
const FINDING_STATUS_ENUM = ['planned', 'inProgress', 'done'];

const TOOLS = [
  {
    name: 'list_articles',
    description:
      '列出当前保存的所有论文项目（id、title、targetJournal、status、章节数、引文数、updatedAt）。任何写入或建议前都应先调用本工具确认 articleId 和题目；不要凭对话猜文章名。返回非常轻量（不含正文），是默认起点。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    storageCall: 'loadState',
  },
  {
    name: 'find_article',
    description:
      '按标题、目标期刊或状态模糊查找论文，返回匹配的轻量列表（id、title、status、updatedAt）。当用户用一个不完整的论文名提及某篇稿件时，先调用本工具定位 articleId。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '标题或期刊的子串匹配，大小写不敏感。可空字符串以列出全部并仅按 status 过滤。',
        },
        status: {
          type: 'string',
          enum: ARTICLE_STATUS_ENUM,
          description: '可选：仅返回该状态的文章。',
        },
        limit: {
          type: 'integer',
          description: '最多返回多少条，默认 20。',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    storageCall: 'loadState',
  },
  {
    name: 'list_sections',
    description:
      '列出指定论文的所有章节摘要：sectionType、字数、块数、最后更新时间、第一句话。比 get_article 轻得多，适合在选择 sectionType 前快速预览结构。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'getArticleById',
  },
  {
    name: 'get_section_summary',
    description:
      '获取某一章节的轻量摘要：字数、块数、首末段（截断）、最后修改时间。适合在动笔扩写前快速回顾，而无需拉整章正文。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        sectionType: {
          type: 'string',
          enum: SECTION_TYPE_ENUM,
          description: '目标章节类型。',
        },
      },
      required: ['articleId', 'sectionType'],
      additionalProperties: false,
    },
    storageCall: 'getArticleById',
  },
  {
    name: 'get_article',
    description:
      '获取单篇论文的完整记录，包括元信息、研究上下文、章节块、参考文献和审稿记录。已知 articleId 且需要查看文章全貌或为后续写入操作做依据时调用。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'getArticleById',
  },
  {
    name: 'get_research_context',
    description:
      '读取指定论文的研究上下文，用于写作前确认背景、假设、目标和关键方法。底层调用 getArticleById，toolRouter 只抽取 researchContext 字段作为结果。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'getArticleById',
  },
  {
    name: 'list_citations',
    description:
      '列出指定论文已经记录的参考文献信息，用于补正文献、检查引用覆盖或写 References 前核对材料。底层调用 getArticleById，toolRouter 只抽取 citations 数组。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'getArticleById',
  },
  {
    name: 'list_pending_reviews',
    description:
      '列出指定论文尚未完成的审稿意见，用于修回计划、回复信草稿或继续处理未完成评论。底层调用 getArticleById，toolRouter 会过滤 reviewRounds[].comments[] 中 status 不等于 Completed 的条目。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'getArticleById',
  },
  {
    name: 'get_writing_guidance',
    description:
      '根据论文的研究上下文获取指定章节的写作提示，用于起草、扩写或检查章节结构前。targetSection 必须是标准学术章节类型，适合在动笔前先获得方向性建议。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        targetSection: {
          type: 'string',
          enum: SECTION_TYPE_ENUM,
          description: '需要获取写作建议的目标章节。',
        },
      },
      required: ['articleId', 'targetSection'],
      additionalProperties: false,
    },
    storageCall: 'getWritingGuidance',
  },
  {
    name: 'get_word_count',
    description:
      '统计指定论文正文块的字数，用于评估写作进度、章节长度或今日产出。该工具通过 loadState 读取状态后由 toolRouter 从 blocks 派生字数，不直接修改任何内容。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'loadState',
  },
  {
    name: 'create_article',
    description:
      '创建新的论文项目，用于用户要开始整理一篇新稿件或把新的研究主题纳入待办系统时。可同时写入目标期刊、初始状态、研究上下文（科学问题/现象/假设/方案），属于写入操作。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '论文标题。' },
        targetJournal: { type: 'string', description: '目标期刊，可为空。' },
        status: { type: 'string', enum: ARTICLE_STATUS_ENUM, description: '初始状态，默认 Drafting。' },
        researchContext: {
          type: 'object',
          properties: {
            scientificQuestion: { type: 'string', description: '科学问题。' },
            observedPhenomenon: { type: 'string', description: '观察到的现象。' },
            hypothesis: { type: 'string', description: '研究假设。' },
            approach: { type: 'string', description: '研究方案 / 关键方法。' },
          },
          required: [],
          additionalProperties: false,
          description: '初始研究上下文（与 storage 字段一一对应）。',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
    storageCall: 'createArticle',
  },
  {
    name: 'delete_article',
    description:
      '彻底删除一篇论文：从数据库移除，删除其附件目录（Articles/{articleId}/），并从所有学位论文 (thesis) 的关联中解开。**不可撤销**，建议先确认 articleId（list_articles 拿）。进度日志条目 (progress_entries) 会保留以保留历史。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string', description: '要删除的论文 ID。' },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'deleteArticle',
  },
  {
    name: 'update_article_meta',
    description:
      '更新论文的标题、目标期刊或投稿状态，用于用户明确要求修改文章元信息时。该工具会改变现有文章记录，适合保存状态流转、换刊或题名调整。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        patch: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '新的论文标题。',
            },
            targetJournal: {
              type: 'string',
              description: '新的目标期刊。',
            },
            status: {
              type: 'string',
              enum: ARTICLE_STATUS_ENUM,
              description: '新的论文状态。',
            },
          },
          required: [],
          additionalProperties: false,
          description: '需要更新的文章元信息字段。',
        },
      },
      required: ['articleId', 'patch'],
      additionalProperties: false,
    },
    storageCall: 'updateArticleMeta',
  },
  {
    name: 'update_research_context',
    description:
      '更新论文的研究上下文，用于用户修正背景、假设、研究目标或关键方法时。该工具会覆盖对应上下文字段，适合在生成正文建议前先校准研究叙事。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        researchContext: {
          type: 'object',
          properties: {
            scientificQuestion: {
              type: 'string',
              description: '研究的科学问题（一句话）。',
            },
            observedPhenomenon: {
              type: 'string',
              description: '已观察到的关键现象 / 反常 / 数据线索。',
            },
            hypothesis: {
              type: 'string',
              description: '研究假设。',
            },
            approach: {
              type: 'string',
              description: '研究方案 / 关键方法路径。',
            },
          },
          required: [],
          additionalProperties: false,
          description: '新的研究上下文内容。仅传入需要修改的字段，未传入字段会保持当前值（storage 在 normalize 时空字符串视为未填写，请避免显式传空串覆盖已有内容）。',
        },
      },
      required: ['articleId', 'researchContext'],
      additionalProperties: false,
    },
    storageCall: 'updateResearchContext',
  },
  {
    name: 'add_text_block',
    description:
      '【仅当目标章节当前还没有任何 Text 类型 block 时使用】给一个空白章节写入第一段正文。如果章节已有 text block，绝不要用本工具——必须改用 update_text_block 把新内容追加 / 改写到现有 block。papertodo 实行单块策略：每章节最多 1 个 text block。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        sectionType: {
          type: 'string',
          enum: SECTION_TYPE_ENUM,
          description: '要添加文本块的章节类型。',
        },
        content: {
          type: 'string',
          description: '文本块正文内容。',
        },
        description: {
          type: 'string',
          description: '文本块说明或修改备注。',
        },
      },
      required: ['articleId', 'sectionType', 'content'],
      additionalProperties: false,
    },
    storageCall: 'addTextBlock',
  },
  {
    name: 'update_text_block',
    description:
      '修改已有文本块的整段正文。用户说"改这段 / 改写 / 帮我加一段 / 扩写"等都用本工具——把新内容（包括追加段落）作为完整 content 写回。content 是整块的最终内容，不是 diff，不要只传新增部分。如果用户想"加一段"，请把现有正文 + 新段落拼成完整 content 一起传。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        blockId: {
          type: 'string',
          description: '要更新的文本块 ID。',
        },
        content: {
          type: 'string',
          description: '新的文本块正文内容。',
        },
        description: {
          type: 'string',
          description: '本次更新说明。',
        },
      },
      required: ['articleId', 'blockId', 'content'],
      additionalProperties: false,
    },
    storageCall: 'updateTextBlock',
  },
  {
    name: 'delete_block',
    description:
      '删除指定论文中的内容块，用于用户明确要求移除错误段落、重复材料或不再需要的附件记录时。该工具会永久改变文章结构，调用前必须确认 articleId 和 blockId。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        blockId: {
          type: 'string',
          description: '要删除的内容块 ID。',
        },
      },
      required: ['articleId', 'blockId'],
      additionalProperties: false,
    },
    storageCall: 'deleteBlock',
  },
  {
    name: 'add_citation',
    description:
      '向指定论文添加参考文献记录，用于用户提供 BibTeX、题名、作者、年份或本地 PDF 路径时。该工具会写入 citations 数组，并可记录该文献与哪些章节相关。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        payload: {
          type: 'object',
          properties: {
            bibtex: {
              type: 'string',
              description: 'BibTeX 条目。',
            },
            title: {
              type: 'string',
              description: '文献题名。',
            },
            authors: {
              type: 'string',
              description: '作者列表。',
            },
            year: {
              type: 'string',
              description: '发表年份（YYYY 字符串，与 types.ts Citation.year 对齐）。',
            },
            localPdfPath: {
              type: 'string',
              description: '本地 PDF 文件路径。',
            },
            relevantSections: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: '该文献相关的章节类型列表。',
            },
          },
          required: [],
          additionalProperties: false,
          description: '需要新增的参考文献信息。',
        },
      },
      required: ['articleId', 'payload'],
      additionalProperties: false,
    },
    storageCall: 'addCitation',
  },
  {
    name: 'add_review_round',
    description:
      '为论文新增一轮审稿记录，用于收到投稿、返修或需要登记新审稿轮次时。该工具会写入 reviewRounds，适合在录入具体审稿意见前先建立轮次。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        payload: {
          type: 'object',
          properties: {
            journalName: {
              type: 'string',
              description: '审稿期刊名称。',
            },
            submissionDate: {
              type: 'string',
              description: '投稿日期或本轮提交日期。',
            },
            notes: {
              type: 'string',
              description: '本轮审稿备注。',
            },
          },
          required: [],
          additionalProperties: false,
          description: '新增审稿轮次的信息。',
        },
      },
      required: ['articleId', 'payload'],
      additionalProperties: false,
    },
    storageCall: 'addReviewRound',
  },
  {
    name: 'add_review_comment',
    description:
      '向指定审稿轮次添加一条审稿意见，用于记录 reviewer 的 major 或 minor comment。该工具会写入评论并可指定建议修改章节和初始处理状态。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        roundId: {
          type: 'string',
          description: '审稿轮次 ID。',
        },
        payload: {
          type: 'object',
          properties: {
            originalText: {
              type: 'string',
              description: '审稿意见原文。',
            },
            type: {
              type: 'string',
              enum: REVIEW_COMMENT_TYPE_ENUM,
              description: '审稿意见类型。',
            },
            suggestedSection: {
              type: 'string',
              description: '建议修改的章节。',
            },
            status: {
              type: 'string',
              enum: REVIEW_COMMENT_STATUS_ENUM,
              description: '审稿意见处理状态。',
            },
          },
          required: ['originalText', 'type'],
          additionalProperties: false,
          description: '需要新增的审稿意见内容。',
        },
      },
      required: ['articleId', 'roundId', 'payload'],
      additionalProperties: false,
    },
    storageCall: 'addReviewComment',
  },
  {
    name: 'update_review_comment_status',
    description:
      '更新单条审稿意见的处理状态，用于标记待处理、处理中或已完成。该工具只改变评论状态，不会自动新增修改记录或回复文本。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        roundId: {
          type: 'string',
          description: '审稿轮次 ID。',
        },
        commentId: {
          type: 'string',
          description: '审稿意见 ID。',
        },
        status: {
          type: 'string',
          enum: REVIEW_COMMENT_STATUS_ENUM,
          description: '新的处理状态。',
        },
      },
      required: ['articleId', 'roundId', 'commentId', 'status'],
      additionalProperties: false,
    },
    storageCall: 'updateReviewCommentStatus',
  },
  {
    name: 'add_revision',
    description:
      '为审稿意见添加一条修改记录和回复内容，用于记录已经做了什么改动以及如何回复 reviewer。可关联被修改的文本块，并可在同一次操作中把该评论标记为 Completed。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        roundId: {
          type: 'string',
          description: '审稿轮次 ID。',
        },
        commentId: {
          type: 'string',
          description: '审稿意见 ID。',
        },
        payload: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: '本次修改说明。',
            },
            responseText: {
              type: 'string',
              description: '给审稿人的回复文本。',
            },
            modifiedBlockIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: '本次修改涉及的文本块 ID 列表。',
            },
            isVerified: {
              type: 'boolean',
              description: '是否已经人工核验。',
            },
            markCompleted: {
              type: 'boolean',
              description: '是否同时标记该审稿意见已完成。',
            },
          },
          required: ['description', 'responseText'],
          additionalProperties: false,
          description: '新增修改记录的内容。',
        },
      },
      required: ['articleId', 'roundId', 'commentId', 'payload'],
      additionalProperties: false,
    },
    storageCall: 'addRevision',
  },
  {
    name: 'add_tag',
    description:
      '给指定论文添加标签，用于按主题、优先级、实验类型或投稿阶段进行归类。该工具会写入标签名称和颜色，重复标签通常由存储层保持为已有结果。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        tagName: {
          type: 'string',
          description: '标签名称。',
        },
        tagColor: {
          type: 'string',
          description: '标签颜色，建议使用十六进制颜色值。',
        },
      },
      required: ['articleId', 'tagName', 'tagColor'],
      additionalProperties: false,
    },
    storageCall: 'addTag',
  },
  {
    name: 'remove_tag',
    description:
      '从指定论文移除一个标签，用于用户明确要求删除错误分类或过期标记时。该工具会改变文章的 tags 列表，调用前应确认 tagId 来自当前文章。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        tagId: {
          type: 'string',
          description: '要移除的标签 ID。',
        },
      },
      required: ['articleId', 'tagId'],
      additionalProperties: false,
    },
    storageCall: 'removeTag',
  },
  {
    name: 'create_thesis',
    description:
      '创建新的学位论文项目，用于把多篇文章或一个完整毕业论文主题纳入系统管理时。该工具会写入论文元信息、摘要、关键词和关联文章列表，属于需要用户确认的写入操作。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '学位论文中文标题。',
        },
        titleEn: {
          type: 'string',
          description: '学位论文英文标题。',
        },
        author: {
          type: 'string',
          description: '作者姓名。',
        },
        supervisor: {
          type: 'string',
          description: '导师姓名。',
        },
        institution: {
          type: 'string',
          description: '培养单位或学校。',
        },
        department: {
          type: 'string',
          description: '院系或专业方向。',
        },
        degree: {
          type: 'string',
          enum: DEGREE_TYPE_ENUM,
          description: '学位类型。',
        },
        status: {
          type: 'string',
          enum: THESIS_STATUS_ENUM,
          description: '学位论文状态。',
        },
        articleIds: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: '初始关联的论文项目 ID 列表。',
        },
        abstractZh: {
          type: 'string',
          description: '中文摘要。',
        },
        abstractEn: {
          type: 'string',
          description: '英文摘要。',
        },
        keywords: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: '关键词列表。',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
    storageCall: 'createThesis',
  },
  {
    name: 'link_article_to_thesis',
    description:
      '把已有论文项目关联到学位论文，用于将文章成果纳入毕业论文框架或章节来源管理时。该工具会更新 thesis 的 articleIds 列表，不会复制文章正文。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        thesisId: {
          type: 'string',
          description: '学位论文项目 ID。',
        },
        articleId: {
          type: 'string',
          description: '要关联的论文项目 ID。',
        },
      },
      required: ['thesisId', 'articleId'],
      additionalProperties: false,
    },
    storageCall: 'linkArticleToThesis',
  },
  {
    name: 'zotero_search_library',
    description:
      '在 Zotero 文献库中按题名、作者或年份搜索条目，用于查找可引用文献、定位 itemKey 或快速确认已有资料。该工具只读取 Zotero 本地服务，不修改文献库。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，可为题名、作者或年份。',
        },
        limit: {
          type: 'number',
          description: '最多返回的条目数量，默认 25。',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    storageCall: '__zotero__',
  },
  {
    name: 'zotero_get_item_details',
    description:
      '读取 Zotero 指定条目的详细元数据和子附件摘要，用于查看摘要、作者、期刊、DOI、附件等信息。需要已知 Zotero itemKey。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        itemKey: {
          type: 'string',
          description: 'Zotero 条目的 itemKey。',
        },
      },
      required: ['itemKey'],
      additionalProperties: false,
    },
    storageCall: '__zotero__',
  },
  {
    name: 'zotero_list_collections',
    description:
      '列出 Zotero 文献库中的收藏夹，用于选择 collectionKey 或了解文献组织结构。该工具只返回收藏夹摘要，不读取具体文献内容。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    storageCall: '__zotero__',
  },
  {
    name: 'zotero_get_collection_items',
    description:
      '读取 Zotero 指定收藏夹中的文献条目，用于按项目、主题或文件夹获取候选参考文献。需要已知 collectionKey。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        collectionKey: {
          type: 'string',
          description: 'Zotero 收藏夹的 collectionKey。',
        },
        limit: {
          type: 'number',
          description: '最多返回的条目数量，默认 50。',
        },
      },
      required: ['collectionKey'],
      additionalProperties: false,
    },
    storageCall: '__zotero__',
  },
  {
    name: 'zotero_get_item_fulltext',
    description:
      '读取 Zotero 指定条目的全文索引内容，用于从已索引 PDF 或附件中提取可检索正文。需要已知 Zotero itemKey。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        itemKey: {
          type: 'string',
          description: 'Zotero 条目的 itemKey。',
        },
      },
      required: ['itemKey'],
      additionalProperties: false,
    },
    storageCall: '__zotero__',
  },
  {
    name: 'attach_file',
    description:
      '将本地磁盘上一个文件作为附件导入指定论文章节，自动复制到 Articles/<articleId>/Attachments/ 并写一个 Image 或 FileLink 块。kind=image 用于 png/jpg/svg/tif/pdf 等图像类预览，kind=file 用于通用资料（pdf/docx/xlsx/csv/txt 等）。要求 sourcePath 是绝对路径并且文件存在。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: '论文项目 ID。',
        },
        sectionType: {
          type: 'string',
          enum: SECTION_TYPE_ENUM,
          description: '导入到哪个章节。',
        },
        sourcePath: {
          type: 'string',
          description: '本地磁盘上的源文件绝对路径。文件会被复制到论文 Attachments 目录。',
        },
        kind: {
          type: 'string',
          enum: ['image', 'file'],
          description: '附件类型：image 表示作为图像块插入并尝试预览；file 表示作为通用文件链接块。',
        },
        description: {
          type: 'string',
          description: '可选的附件说明，写入 block.description。',
        },
      },
      required: ['articleId', 'sectionType', 'sourcePath', 'kind'],
      additionalProperties: false,
    },
    storageCall: 'addAssetBlock',
  },
  {
    name: 'add_progress_entry',
    description:
      '记录一项当日科研进展（小任务），比章节更细、比单次编辑更明确：读了一篇论文、跑了一次实验、想到一个新假设、录入一条引用、写了一段、跑了一次分析。每条都必须挂到一篇论文。这是除字数外用来反映"今天我做了什么"的主要数据来源。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string', description: '关联的论文 ID（必填）。' },
        kind: { type: 'string', enum: PROGRESS_KIND_ENUM, description: '进展类型。read=读文献；experiment=做实验；writing=写正文（一般由 add_text_block 自动派生，手工很少用）；idea=新想法/假设；cite=录入参考文献；analysis=数据分析。' },
        title: { type: 'string', description: '一句话描述这件事，例如"读了 Smith 2024，找到 piRNA 通路反例"。' },
        detail: { type: 'string', description: '可选的更长描述。' },
        sectionId: { type: 'string', description: '可选：关联到哪个章节。' },
        findingId: { type: 'string', description: '可选：关联到 Results 下的某个 Finding（小结果点）。' },
        citationId: { type: 'string', description: '可选：关联的引文 id。' },
        minutesSpent: { type: 'integer', description: '可选：本次花的分钟数。' },
        date: { type: 'string', description: '可选：YYYY-MM-DD，缺省为今天。' },
      },
      required: ['articleId', 'kind', 'title'],
      additionalProperties: false,
    },
    storageCall: 'addProgressEntry',
  },
  {
    name: 'list_progress_entries',
    description:
      '列出科研进展条目，可按 articleId、日期范围、kind、findingId 过滤。用来回顾今日/本周/某文章下做了哪些事，或为收尾总结提供素材。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string', description: '可选。' },
        date: { type: 'string', description: '可选 YYYY-MM-DD，仅返回该日。' },
        dateFrom: { type: 'string', description: '可选 YYYY-MM-DD。' },
        dateTo: { type: 'string', description: '可选 YYYY-MM-DD。' },
        kind: { type: 'string', enum: PROGRESS_KIND_ENUM },
        findingId: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    storageCall: 'listProgressEntries',
  },
  {
    name: 'update_progress_entry',
    description: '修改一条已有进展条目的字段（标题、说明、kind、关联 finding 等）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        entryId: { type: 'string' },
        patch: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            kind: { type: 'string', enum: PROGRESS_KIND_ENUM },
            sectionId: { type: 'string' },
            findingId: { type: 'string' },
            citationId: { type: 'string' },
            minutesSpent: { type: 'integer' },
          },
          additionalProperties: false,
        },
      },
      required: ['entryId', 'patch'],
      additionalProperties: false,
    },
    storageCall: 'updateProgressEntry',
  },
  {
    name: 'delete_progress_entry',
    description: '删除一条进展条目。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: { entryId: { type: 'string' } },
      required: ['entryId'],
      additionalProperties: false,
    },
    storageCall: 'deleteProgressEntry',
  },
  {
    name: 'link_progress_to_finding',
    description: '把一条已存在的进展条目挂到某个 Finding（结果小点）下。常见场景：先记了一个 PCR 结果，后来确定它支撑 Result 1 的某个 finding。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        entryId: { type: 'string' },
        findingId: { type: 'string' },
      },
      required: ['entryId', 'findingId'],
      additionalProperties: false,
    },
    storageCall: 'linkProgressEntryToFinding',
  },
  {
    name: 'add_finding',
    description:
      '在某篇论文的指定章节下新增一个 Finding（结果小点），主要用于 Results 章节，把"Result 1 = ..."这样的子结论显式建出来，方便后续把多次实验、分析、读到的反例都挂到它下面。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string' },
        sectionType: { type: 'string', enum: SECTION_TYPE_ENUM, description: '一般是 Results。' },
        title: { type: 'string', description: '小点的概括，例如"Sf9 piRNA 在病毒侵染时上调"。' },
        description: { type: 'string', description: '可选的展开说明。' },
        status: { type: 'string', enum: FINDING_STATUS_ENUM, description: '默认 planned。' },
      },
      required: ['articleId', 'sectionType', 'title'],
      additionalProperties: false,
    },
    storageCall: 'addFinding',
  },
  {
    name: 'list_findings',
    description: '列出某篇论文下的 Findings，可指定 sectionType。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string' },
        sectionType: { type: 'string', enum: SECTION_TYPE_ENUM },
      },
      required: ['articleId'],
      additionalProperties: false,
    },
    storageCall: 'listFindings',
  },
  {
    name: 'update_finding',
    description: '修改 Finding 的标题、说明、status（planned/inProgress/done）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string' },
        findingId: { type: 'string' },
        patch: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: FINDING_STATUS_ENUM },
          },
          additionalProperties: false,
        },
      },
      required: ['articleId', 'findingId', 'patch'],
      additionalProperties: false,
    },
    storageCall: 'updateFinding',
  },
  {
    name: 'delete_finding',
    description: '删除 Finding，并解除挂在它下面的进展条目的关联。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string' },
        findingId: { type: 'string' },
      },
      required: ['articleId', 'findingId'],
      additionalProperties: false,
    },
    storageCall: 'deleteFinding',
  },
  {
    name: 'start_daily_session',
    description: '为某天（默认今天）开启一个工作 session，可选写一个 plan。同一天重复调用是幂等的。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD，缺省今天。' },
        planText: { type: 'string', description: '可空。' },
      },
      required: [],
      additionalProperties: false,
    },
    storageCall: 'startDailySession',
  },
  {
    name: 'set_daily_plan',
    description: '修改某天的 plan 文本（不存在的 session 会自动创建）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        planText: { type: 'string' },
      },
      required: ['planText'],
      additionalProperties: false,
    },
    storageCall: 'setDailyPlan',
  },
  {
    name: 'end_daily_session',
    description: '结束某天的 session，可写收尾总结文本。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        summaryText: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    storageCall: 'endDailySession',
  },
  {
    name: 'get_daily_session',
    description: '读取某天（默认今天）的 session：plan、summary、关联的进展条目 id 列表。',
    isWrite: false,
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    storageCall: 'getDailySession',
  },
  {
    name: 'add_pomodoro_session',
    description: '记录一段已经完成的番茄钟专注时段。会更新 pomodoroStats，并可选挂到某篇文章/章节。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        duration: { type: 'number', description: '专注分钟数（如 15、25、45）。' },
        articleId: { type: 'string', description: '可选。挂到该文章。' },
        sectionType: { type: 'string', description: '可选。挂到该章节类型，如 Introduction。' },
      },
      required: ['duration'],
      additionalProperties: false,
    },
    storageCall: 'addPomodoroSession',
  },
  {
    name: 'add_mood_entry',
    description: '记录一条心情。每天每个 mood 只保留一条，新记录覆盖当天旧记录。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        mood: {
          type: 'string',
          enum: ['Happy', 'Calm', 'Excited', 'Motivated', 'Grateful', 'Tired', 'Sad', 'Frustrated', 'Anxious', 'Melancholy'],
          description: '十种心情之一。',
        },
        note: { type: 'string', description: '一句话给心情加注释（可空）。' },
      },
      required: ['mood'],
      additionalProperties: false,
    },
    storageCall: 'addMoodEntry',
  },
  {
    name: 'export_article',
    description:
      '把论文导出成指定格式：markdown / docx / latex / html / json / share。导出文件落在 Articles/<id>/Exports/ 下，返回完整路径。docx 可选 docxTemplate（academic-en / thesis-zh / nature）和 applyItalicGuide（导出前调 LLM 套用学名/拉丁斜体规范，更慢更贵）。share 把文章打包成可分享的目录（含正文、figure、bib）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        articleId: { type: 'string', description: '要导出的论文 id。' },
        format: {
          type: 'string',
          enum: ['markdown', 'docx', 'latex', 'html', 'json', 'share'],
          description: '导出格式。',
        },
        docxTemplate: {
          type: 'string',
          enum: ['academic-en', 'thesis-zh', 'nature'],
          description: '仅 format=docx 时有意义。',
        },
        applyItalicGuide: {
          type: 'boolean',
          description: '仅 format=docx 时有意义。导出前调 LLM 套用学名/拉丁斜体规范。',
        },
      },
      required: ['articleId', 'format'],
      additionalProperties: false,
    },
    storageCall: '__exporter__',
  },
  {
    name: 'get_writing_streak',
    description: '读取写作 streak 状态（连续天数、最长 streak、今日字数、daily goal、history）。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'loadState',
  },
  {
    name: 'update_daily_writing_goal',
    description: '设置每日写作字数目标（goal，正整数，单位字）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: { goal: { type: 'number', description: '每日字数目标，>0' } },
      required: ['goal'],
      additionalProperties: false,
    },
    storageCall: 'updateDailyGoal',
  },
  {
    name: 'get_mood_history',
    description: '读取心情历史（按日期倒序）。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getMoodHistory',
  },
  {
    name: 'get_pomodoro_stats',
    description: '读取番茄钟统计（今日 / 历史）。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getPomodoroStats',
  },
  {
    name: 'get_writing_stats',
    description: '读取写作统计（按论文 / 按天 / 按时段的字数与活动）。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getWritingStats',
  },
  {
    name: 'get_theme',
    description: '读取当前主题。可选三种之一：claude / pixel / fresh。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getTheme',
  },
  {
    name: 'set_theme',
    description: '切换主题。仅支持 claude / pixel / fresh 三种。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['claude', 'pixel', 'fresh'], description: '主题名。' },
      },
      required: ['theme'],
      additionalProperties: false,
    },
    storageCall: 'setTheme',
  },
  {
    name: 'get_auto_approve_tools',
    description: '读取「内置 AI 自动批准所有工具调用」开关当前值。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getAutoApproveTools',
  },
  {
    name: 'set_auto_approve_tools',
    description: '设置「内置 AI 自动批准所有工具调用」开关。开启后写入类工具不再弹出 approve 对话框，AI 会直接执行。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: { value: { type: 'boolean', description: 'true 开启自动批准，false 关闭。' } },
      required: ['value'],
      additionalProperties: false,
    },
    storageCall: 'setAutoApproveTools',
  },
  {
    name: 'list_scenarios',
    description: '列出所有写作场景预设（含 builtin 与用户自定义）。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'listWritingScenarios',
  },
  {
    name: 'add_scenario',
    description: '新增一个用户自定义写作场景。至少包含 name 与 systemPromptAddon。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        systemPromptAddon: { type: 'string', description: '该场景注入到 system prompt 的额外指令。' },
        enabled: { type: 'boolean' },
      },
      required: ['name', 'systemPromptAddon'],
      additionalProperties: true,
    },
    storageCall: 'addWritingScenario',
  },
  {
    name: 'update_scenario',
    description: '更新写作场景。builtin 场景只允许改 systemPromptAddon。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        patch: { type: 'object', description: '要更新的字段；builtin 场景只接受 { systemPromptAddon }' },
      },
      required: ['id', 'patch'],
      additionalProperties: false,
    },
    storageCall: 'updateWritingScenario',
  },
  {
    name: 'delete_scenario',
    description: '删除一个用户自定义场景（builtin 不允许）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    storageCall: 'deleteWritingScenario',
  },
  {
    name: 'reset_scenario',
    description: '把 builtin 场景重置回默认 systemPromptAddon（用户改坏后回滚）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
    storageCall: 'resetWritingScenarioToDefault',
  },
  {
    name: 'get_italic_guide',
    description: '读取 latin / 学名斜体规范配置（enabled + prompt）。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getItalicGuide',
  },
  {
    name: 'set_italic_guide',
    description: '设置 latin / 学名斜体规范。可只传 enabled 或 prompt 任一字段，未传字段保持原值。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'docx 导出时是否调 LLM 自动套斜体。' },
        prompt: { type: 'string', description: '套斜体时给 LLM 的规范 prompt。' },
      },
      required: [],
      additionalProperties: false,
    },
    storageCall: 'setItalicGuide',
  },
  {
    name: 'get_zotero_config',
    description: '读取 Zotero 集成配置（apiKey 在结果里会保留，调用方需注意）。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getZoteroConfig',
  },
  {
    name: 'set_zotero_config',
    description: '设置 Zotero 集成配置。把要更新的字段传进 config 对象。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        apiKey: { type: 'string' },
        userId: { type: 'string' },
        baseUrl: { type: 'string' },
        libraryType: { type: 'string', enum: ['user', 'group'] },
      },
      required: [],
      additionalProperties: true,
    },
    storageCall: 'setZoteroConfig',
  },
  {
    name: 'list_vocab',
    description: '列出用户自定义的补全词与短语。沉浸写作时这些会与内置 sci-vocab 合并到 general 桶里随时可见。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getCustomVocab',
  },
  {
    name: 'add_vocab_word',
    description: '把一个新词加入用户自定义补全库。重复（大小写不敏感）会被忽略。建议是 single token 或 hyphen 复合（≤30 字符），如 spermatheca / cis-regulatory / Cscaspase-3。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        word: { type: 'string', description: '要加入的词。' },
      },
      required: ['word'],
      additionalProperties: false,
    },
    storageCall: 'addCustomVocabWord',
  },
  {
    name: 'remove_vocab_word',
    description: '从用户自定义补全库删除一个词（大小写不敏感）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        word: { type: 'string' },
      },
      required: ['word'],
      additionalProperties: false,
    },
    storageCall: 'removeCustomVocabWord',
  },
  {
    name: 'add_vocab_phrase',
    description: '把一个短语加入用户自定义补全库。trigger 是用户键入≥2 字符的前缀，text 是被插入的完整短语。例：trigger="weshow", text="we show that"。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        trigger: { type: 'string', description: '触发前缀，≥2 字符。' },
        text: { type: 'string', description: '完整插入文本。' },
        label: { type: 'string', description: '弹窗里显示的简短标签（可选）。' },
      },
      required: ['trigger', 'text'],
      additionalProperties: false,
    },
    storageCall: 'addCustomVocabPhrase',
  },
  {
    name: 'remove_vocab_phrase',
    description: '从用户自定义补全库删除短语。仅给 trigger 会删该 trigger 下所有短语；给 trigger+text 精确删一条。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        trigger: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['trigger'],
      additionalProperties: false,
    },
    storageCall: 'removeCustomVocabPhrase',
  },
  {
    name: 'get_user_profile',
    description: '读取用户的显示名（显示在侧边栏与时间问候后）。空字符串表示用户尚未设置。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'getUserProfile',
  },
  {
    name: 'set_user_profile',
    description: '设置用户的显示名。空字符串等于清空（UI 回到默认 "papertodo"）。最长 40 字。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        displayName: { type: 'string', description: '用户希望被称呼的名字（≤40 字）。' },
      },
      required: ['displayName'],
      additionalProperties: false,
    },
    storageCall: 'setUserProfile',
  },
  {
    name: 'list_vocab_packs',
    description: '列出全部补全词库 pack（内置 + 用户导入），含每个 pack 的 id / 名称 / 描述 / 是否内置 / 默认开关 / 用户当前的启用状态。',
    isWrite: false,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    storageCall: 'listVocabPacks',
  },
  {
    name: 'set_vocab_pack_enabled',
    description: '启用或禁用某个补全 pack（内置 / 用户导入皆可）。仅影响沉浸写作时的补全候选；不删除该 pack 内容。返回更新后的 pack 列表。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'pack id，参考 list_vocab_packs。' },
        enabled: { type: 'boolean' },
      },
      required: ['id', 'enabled'],
      additionalProperties: false,
    },
    storageCall: 'setVocabPackEnabled',
  },
  {
    name: 'import_vocab_pack',
    description: '从用户给的 words / phrases 创建一个新的 custom pack。words 可以是字符串数组（默认归到 general 段），也可以是按 IMRaD 段（general/introduction/methods/results/discussion）分桶的对象。导入后默认启用，立即生效。返回新 pack。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '展示名（≤60 字）。' },
        description: { type: 'string', description: '可选的简短描述。' },
        words: {
          description: '字符串数组（直接合到 general 段），或 {general?, introduction?, methods?, results?, discussion?} 形式。',
          oneOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
          ],
        },
        phrases: {
          description: '可选。短语数组（合到 general 段）或按 IMRaD 段分桶。每条 {trigger, text, label?}。',
          oneOf: [
            {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  trigger: { type: 'string' },
                  text: { type: 'string' },
                  label: { type: 'string' },
                },
                required: ['trigger', 'text'],
              },
            },
            { type: 'object' },
          ],
        },
      },
      required: ['name', 'words'],
      additionalProperties: false,
    },
    storageCall: 'importVocabPack',
  },
  {
    name: 'delete_vocab_pack',
    description: '删除一个用户导入的 custom pack（内置 pack 不可删）。删除后该 pack 的启用偏好也一并清除。返回更新后的 pack 列表。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    storageCall: 'deleteCustomVocabPack',
  },
  {
    name: 'rename_vocab_pack',
    description: '重命名用户导入的 custom pack（内置不可改）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
      additionalProperties: false,
    },
    storageCall: 'renameCustomVocabPack',
  },
  {
    name: 'update_thesis_meta',
    description: '更新学位论文元信息（title / status / 等）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        thesisId: { type: 'string' },
        patch: { type: 'object', description: '要更新的元信息字段。' },
      },
      required: ['thesisId', 'patch'],
      additionalProperties: false,
    },
    storageCall: 'updateThesisMeta',
  },
  {
    name: 'add_thesis_section',
    description: '在学位论文中新增一个 section。sectionType 必须是 storage 端的固定 enum 之一。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        thesisId: { type: 'string' },
        sectionType: {
          type: 'string',
          enum: ['Cover', 'Declaration', 'Abstract', 'Acknowledgements', 'TableOfContents', 'ListOfFigures', 'ListOfTables', 'Chapter', 'Conclusion', 'References', 'Appendix'],
        },
        title: { type: 'string' },
      },
      required: ['thesisId', 'sectionType', 'title'],
      additionalProperties: false,
    },
    storageCall: 'addThesisSection',
  },
  {
    name: 'unlink_article_from_thesis',
    description: '从学位论文中解除一篇文章的关联（不会删除文章本身）。',
    isWrite: true,
    parameters: {
      type: 'object',
      properties: {
        thesisId: { type: 'string' },
        articleId: { type: 'string' },
      },
      required: ['thesisId', 'articleId'],
      additionalProperties: false,
    },
    storageCall: 'unlinkArticleFromThesis',
  },
];

module.exports = { TOOLS };
