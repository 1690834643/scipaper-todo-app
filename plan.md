# SciPaper Todo - 科研论文管理工具开发文档

## 当前实现说明（2026-04-10）

本仓库当前已落地为可打包的 Electron + React + TypeScript Windows 桌面应用，核心功能保持原规划不变：

- 仍以论文为核心单元，保留 IMRaD 七章节结构
- 仍为本地优先工作流，数据与附件写入本地目录
- 已实现 MCP server（stdio）供 Cursor / Claude Code 读取与写入论文数据
- UI 已按本轮要求调整为温馨米色主题
- 当前 Windows 产物通过 `electron-builder` 生成，输出 `NSIS` 安装包与 `Portable` 可执行文件

与原始规划相比，当前代码层的主要实现差异如下：

- 桌面壳与界面技术栈：由 WinUI 3 / C# 调整为 Electron + React
- 本地持久化：当前版本使用 `Documents/SciPaperTodo/database.json` + 本地附件目录，而非 SQLite
- 导出：当前已实现 Markdown 导出，Word / PDF 仍可作为后续增强项继续扩展

当前仓库中实际可交付的 Windows 产物目录：

- `release/SciPaper Todo-Setup-1.0.0.exe`
- `release/SciPaper Todo-Portable-1.0.0.exe`

## 近期完善记录（2026-04-11）

在不改变论文管理主功能的前提下，当前版本已继续按本轮反馈完成以下优化：

- 文本块可点击进入大窗口编辑，提升长段内容的可读性与修改效率
- 开屏区域改为问候式入口，按时间显示“早上好 / 下午好 / 晚上好”，移除“温馨米色工作台”字样
- MCP 面板补充了更详细的接入说明，内置 Cursor / Claude Code 配置示例，并支持通过环境变量标记写入来源
- 内容块与附件会记录来源名称与更新时间，便于区分是桌面端还是外部 MCP 客户端写入
- 主进程已监听本地数据库变化，MCP 写入后前端可自动刷新，无需重启软件
- 图片和文件导入现在统一复制到文章目录下的 `Attachments`，既保证引用可用，也形成一份本地备份
- 章节内已支持对 `svg`、`png/jpg/webp/gif/bmp`、`tif/tiff`、`pdf` 的简单预览；其他文件类型保留系统打开入口
- 已移除固定生成的“Suggested Next Steps / 自动任务草案”等冗余内容，避免产生无意义占位信息
- 已清理部分多余按钮，保留论文整理、上下文维护、章节写作、附件管理、审稿追踪和 MCP 配置这些核心能力

## 当前补齐记录（2026-05-06 / v1.0.41）

本仓库当前已从早期 Windows 规划演进为 Windows + macOS 的 Electron 桌面应用。与旧规划不一致时，以 `README.md` 和当前代码为准。本轮补齐了以下高影响使用逻辑：

- Settings → MCP 协议已改为可选客户端配置，覆盖 Cursor、Claude Code、Claude Desktop、VS Code、Cline、Roo Code、Kimi Code、Windsurf、Continue 和通用 MCP JSON。
- 正文 / 审稿导入助手的解析预览可手动修正：正文可改目标章节和内容；审稿意见可改审稿人、Major/Minor、建议章节和意见文本。
- 审稿意见导入时，写入位置明确区分“新建审稿轮次”和“追加到已有 Round”。
- 稿件库补充关键词搜索、只看小论文/大论文、按更新时间/标题/字数排序。
- Markdown、docx、LaTeX、HTML、JSON 和分享包导出后会显示实际输出路径，并保留最近导出路径复制按钮。
- AI Provider 设置要求名称、Base URL、模型和 API Key；temperature 默认按 `0` 保存，新增 Provider 后立即作为当前活动 Provider 反映到前端状态。

## 1. 项目概述

**目标**: 开发面向生命科学领域科研人员的Windows桌面应用，以"论文"为单元管理研究进度，深度集成MCP协议支持AI辅助写作。

**核心定位**:
- 学科领域: 生命科学（生物学、医学等实验学科）
- 论文结构: 严格遵循IMRaD结构（题目/Title、摘要/Abstract、前言/Introduction、材料方法/Materials & Methods、结果/Results、讨论/Discussion、参考文献/References）
- 工作模式: 本地优先（SQLite + 本地文件），无云端同步，支持导出
- AI集成: 双向MCP通信，支持Cursor/Claude Code等工具读写论文数据

## 2. 数据模型设计（C#类定义）

### 2.1 核心实体

```csharp
// 文章主实体
public class Article
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = "未命名研究";
    public string TargetJournal { get; set; } = "";
    public ArticleStatus Status { get; set; } = ArticleStatus.Drafting;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    
    // 导航属性
    public ResearchContext ResearchContext { get; set; }
    public List<Section> Sections { get; set; }
    public List<ReviewRound> ReviewRounds { get; set; } = new();
    public List<Citation> Citations { get; set; } = new();
}

public enum ArticleStatus
{
    Drafting,      // 撰写中
    Submitted,     // 已投稿
    UnderReview,   // 审稿中
    Revision,      // 需修改
    Resubmitted,   // 修回
    Accepted,      // 接收
    Rejected,      // 拒稿
    Published      // 已发表
}

// 研究上下文（创建时通过4个问题收集）
public class ResearchContext
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArticleId { get; set; }
    
    [Required]
    public string ScientificQuestion { get; set; } // 你想解决什么科学问题？
    
    [Required]
    public string ObservedPhenomenon { get; set; } // 你发现了什么科学现象？
    
    [Required]
    public string Hypothesis { get; set; } // 你的假设是什么？
    
    [Required]
    public string Approach { get; set; } // 你准备怎么做？
    
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}

// 章节实体（固定7个）
public class Section
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArticleId { get; set; }
    public SectionType Type { get; set; }
    public int OrderIndex { get; set; } // 排序：0-6对应IMRaD
    
    // 导航属性
    public List<ContentBlock> ContentBlocks { get; set; } = new();
}

public enum SectionType
{
    Title = 0,
    Abstract = 1,
    Introduction = 2,
    MaterialsAndMethods = 3,
    Results = 4,
    Discussion = 5,
    References = 6
}

// 内容块（支持文本、图片、文件链接）
public class ContentBlock
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SectionId { get; set; }
    public BlockType Type { get; set; }
    public string Content { get; set; } // 文本内容或文件路径
    public string? Description { get; set; } // 对文件/图片的描述
    public int OrderIndex { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    
    // 版本控制（每次修改都记录）
    public List<ContentBlockVersion> Versions { get; set; } = new();
}

public enum BlockType
{
    Text,      // 纯文本/富文本
    Image,     // 图片（实际存储为本地路径）
    FileLink   // 本地文件链接（PDF、Excel、PPT等）
}

public class ContentBlockVersion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ContentBlockId { get; set; }
    public string Content { get; set; }
    public DateTime ModifiedAt { get; set; } = DateTime.Now;
    public string ModifiedBy { get; set; } = "User"; // 或 "AI"（通过MCP修改时）
    public string ChangeDescription { get; set; } // 修改说明
}

// 参考文献
public class Citation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArticleId { get; set; }
    public string BibTeX { get; set; } // 完整BibTeX条目
    public string Title { get; set; }
    public string Authors { get; set; }
    public string Year { get; set; }
    public string LocalPdfPath { get; set; } // 本地PDF路径
    public List<CitationSectionLink> SectionLinks { get; set; } = new(); // 哪些章节引用了
}

public class CitationSectionLink
{
    public Guid CitationId { get; set; }
    public Guid SectionId { get; set; }
    public string Context { get; set; } // 引用上下文（如"正如Smith et al.所示..."）
}

// 审稿管理（多轮审稿）
public class ReviewRound
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArticleId { get; set; }
    public int RoundNumber { get; set; } // 第几轮（1, 2, 3...）
    public DateTime SubmittedAt { get; set; } // 投稿日期
    public string JournalName { get; set; }
    public string ManuscriptNumber { get; set; } // 稿件号
    public DateTime? ReviewReceivedAt { get; set; } // 收到审稿意见日期
    public List<ReviewComment> Comments { get; set; } = new();
}

public class ReviewComment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReviewRoundId { get; set; }
    public string ReviewerId { get; set; } // 审稿人编号（如"Reviewer 1"）
    public string OriginalText { get; set; } // 原始审稿意见
    public CommentType Type { get; set; } // Major/Minor
    public string SuggestedSection { get; set; } // 建议修改的章节（可选）
    
    // 状态追踪
    public CommentStatus Status { get; set; } = CommentStatus.Pending;
    public List<Revision> Revisions { get; set; } = new(); // 对应的修改记录
}

public enum CommentType
{
    Major,  // 重大问题
    Minor   // 次要问题
}

public enum CommentStatus
{
    Pending,     // 待处理
    InProgress,  // 修改中
    Completed,   // 已完成
    Disagreed    // 不同意（需解释原因）
}

public class Revision
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReviewCommentId { get; set; }
    public string Description { get; set; } // 修改描述（如"重新绘制图3"）
    public string ResponseText { get; set; } // 给审稿人的回复信内容
    public List<Guid> ModifiedBlockIds { get; set; } = new(); // 修改了哪些ContentBlocks
    public DateTime CompletedAt { get; set; } = DateTime.Now;
    public bool IsVerified { get; set; } = false; // 标记为已复核
}
2.2 文件夹结构约定
plain
复制
%USERPROFILE%\Documents\SciPaperTodo\
├── database.db              // SQLite数据库
└── Articles\
    └── {ArticleId}\
        ├── Attachments\     // 所有附件（图片、PDF等）
        │   ├── figure1.png
        │   ├── western_blot_data.xlsx
        │   └── reference_papers\
        └── Exports\         // 导出的文件
3. 技术架构
3.1 技术栈选择
UI框架: WinUI 3 (Windows App SDK 1.5+)
架构模式: MVVM (CommunityToolkit.Mvvm)
数据库: SQLite (Microsoft.Data.Sqlite)
ORM: Dapper（轻量，适合本地应用）
MCP SDK: ModelContextProtocol C# SDK (或手动实现stdio/SSE)
导出:
Markdown: 自定义模板
Word: DocumentFormat.OpenXml SDK
PDF: 调用Pandoc（如果用户已安装）或WebView2打印
3.2 项目结构
plain
复制
SciPaperTodo/
├── App.xaml                  // 应用入口
├── MainWindow.xaml           // 主窗口
├── Views/                    // 视图层
│   ├── ArticleListPage.xaml  // 文章列表
│   ├── ArticleEditPage.xaml   // 文章编辑（核心界面）
│   ├── ResearchContextDialog.xaml // 创建向导
│   └── ReviewManagerPage.xaml // 审稿管理
├── ViewModels/               // MVVM视图模型
│   ├── ArticleViewModel.cs
│   └── SectionViewModel.cs
├── Models/                   // 数据模型（第2节定义的类）
├── Services/                 // 业务逻辑
│   ├── DatabaseService.cs    // SQLite操作
│   ├── FileService.cs        // 本地文件管理
│   ├── ExportService.cs      // 导出逻辑
│   └── McpServerService.cs   // MCP服务（核心）
├── Database/
│   └── Schema.sql            // 数据库初始化脚本
└── Assets/                   // 静态资源
4. MCP协议规范（核心）
实现MCP Server，支持stdio模式（由主应用启动子进程通信）。
4.1 Resources（AI读取数据）
JSON
复制
{
  "resources": [
    {
      "uri": "scipaper://article/{id}/overview",
      "name": "Article Overview",
      "description": "获取文章全景：标题、研究上下文、各章节状态、当前审稿轮次",
      "mimeType": "application/json"
    },
    {
      "uri": "scipaper://article/{id}/section/{section_type}",
      "name": "Section Content",
      "description": "获取特定章节内容（section_type: title/abstract/introduction/methods/results/discussion/references）",
      "mimeType": "application/json"
    },
    {
      "uri": "scipaper://article/{id}/research-context",
      "name": "Research Context",
      "description": "获取科学问题、假设、方案等核心信息",
      "mimeType": "application/json"
    },
    {
      "uri": "scipaper://article/{id}/pending-reviews",
      "name": "Pending Reviews",
      "description": "获取待处理的审稿意见列表",
      "mimeType": "application/json"
    },
    {
      "uri": "scipaper://article/{id}/citations",
      "name": "Citations",
      "description": "获取参考文献列表",
      "mimeType": "application/json"
    }
  ]
}
Resource返回格式示例（Overview）：
JSON
复制
{
  "id": "guid",
  "title": "未命名研究",
  "target_journal": "Nature Cell Biology",
  "status": "Drafting",
  "research_context": {
    "question": "XX蛋白在YY信号通路中的作用机制",
    "phenomenon": "敲除XX后细胞出现ZZ现象",
    "hypothesis": "XX通过调控WW影响YY通路",
    "approach": "使用CRISPR敲除+RNA-seq+免疫共沉淀"
  },
  "sections_completion": {
    "title": { "block_count": 1, "last_modified": "2026-04-10" },
    "results": { "block_count": 5, "last_modified": "2026-04-10" }
  },
  "active_review_round": 1,
  "pending_comments_count": 3
}
4.2 Tools（AI操作数据）
JSON
复制
{
  "tools": [
    {
      "name": "add_finding",
      "description": "向Results章节添加研究发现（支持文字和图片路径）",
      "inputSchema": {
        "type": "object",
        "properties": {
          "article_id": { "type": "string", "format": "uuid" },
          "content": { "type": "string", "description": "发现描述" },
          "image_paths": { "type": "array", "items": { "type": "string" }, "description": "本地图片路径列表（可选）" },
          "file_links": { "type": "array", "items": { "type": "string" }, "description": "原始数据文件路径（可选）" }
        },
        "required": ["article_id", "content"]
      }
    },
    {
      "name": "update_section",
      "description": "更新特定章节内容（追加或替换）",
      "inputSchema": {
        "type": "object",
        "properties": {
          "article_id": { "type": "string" },
          "section": { "type": "string", "enum": ["title", "abstract", "introduction", "methods", "results", "discussion"] },
          "content": { "type": "string" },
          "mode": { "type": "string", "enum": ["append", "replace"], "default": "append" },
          "description": { "type": "string", "description": "修改说明（用于版本记录）" }
        },
        "required": ["article_id", "section", "content"]
      }
    },
    {
      "name": "add_citation",
      "description": "添加参考文献（可由Claude Code读取PDF后调用）",
      "inputSchema": {
        "type": "object",
        "properties": {
          "article_id": { "type": "string" },
          "bibtex": { "type": "string" },
          "title": { "type": "string" },
          "authors": { "type": "string" },
          "year": { "type": "string" },
          "local_pdf": { "type": "string", "description": "本地PDF路径" },
          "relevant_sections": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    {
      "name": "record_review_comment",
      "description": "记录新收到的审稿意见",
      "inputSchema": {
        "type": "object",
        "properties": {
          "article_id": { "type": "string" },
          "round": { "type": "integer" },
          "reviewer_id": { "type": "string" },
          "comment_text": { "type": "string" },
          "comment_type": { "type": "string", "enum": ["major", "minor"] },
          "suggested_section": { "type": "string" }
        }
      }
    },
    {
      "name": "mark_revision_completed",
      "description": "标记某条审稿意见的修改已完成",
      "inputSchema": {
        "type": "object",
        "properties": {
          "comment_id": { "type": "string" },
          "response_text": { "type": "string", "description": "给审稿人的回复内容" },
          "modified_block_ids": { "type": "array", "items": { "type": "string" } },
          "description": { "type": "string", "description": "具体修改描述" }
        }
      }
    },
    {
      "name": "get_writing_guidance",
      "description": "基于ResearchContext生成写作建议",
      "inputSchema": {
        "type": "object",
        "properties": {
          "article_id": { "type": "string" },
          "target_section": { "type": "string" }
        }
      }
    }
  ]
}
4.3 Prompts（AI辅助模板）
JSON
复制
{
  "prompts": [
    {
      "name": "generate-outline",
      "description": "基于ResearchContext生成论文大纲建议",
      "arguments": [
        { "name": "article_id", "description": "文章ID", "required": true }
      ]
    },
    {
      "name": "analyze-results",
      "description": "分析Results章节内容，建议Discussion写作方向",
      "arguments": [
        { "name": "article_id", "description": "文章ID", "required": true }
      ]
    },
    {
      "name": "draft-response-letter",
      "description": "基于当前修改记录生成给审稿人的回复信草稿",
      "arguments": [
        { "name": "article_id", "description": "文章ID", "required": true },
        { "name": "round", "description": "审稿轮次", "required": true }
      ]
    }
  ]
}
5. UI界面设计规范
5.1 主界面布局
左侧导航栏（NavigationView）:
顶部：应用标题 + 新建文章按钮
中部：文章列表（显示标题+最后修改时间）
底部：设置、MCP状态指示器
中间编辑区（核心）:
plain
复制
┌─────────────────────────────────────────────────────┐
│ 标题栏: [文章标题]          [目标期刊] [状态下拉]    │
├─────────────────────────────────────────────────────┤
│ 左侧面板:              │ 右侧面板:                   │
│ [章节导航]             │ [内容编辑区]                │
│ • 题目                 │ ┌─────────────────────────┐ │
│ • 摘要                 │ │ [ContentBlock列表]      │ │
│ • 前言                 │ │ • 文本块 [编辑] [删除]    │ │
│ • 材料方法             │ │ • 图片 [预览] [打开]      │ │
│ • 结果                 │ │ • 文件 [打开文件]         │ │
│ • 讨论                 │ │                         │ │
│ • 参考文献             │ │ [+ 添加内容] 按钮         │ │
│                      │ └─────────────────────────┘ │
│ [审稿管理] 按钮        │                             │
│ [研究上下文] 按钮      │                             │
└─────────────────────────────────────────────────────┘
5.2 创建向导（模态对话框）
步骤1: 显示大标题 "开始你的新研究"
步骤2: 输入 "你想解决什么科学问题？"（多行文本，必填）
步骤3: 输入 "你发现了什么科学现象？"（多行文本，必填）
步骤4: 输入 "你的假设是什么？"（多行文本，必填）
步骤5: 输入 "你准备怎么做？"（多行文本，必填）
步骤6: 确认生成，显示自动生成的章节骨架
5.3 ContentBlock渲染
Text Block: 使用RichEditBox（支持基础格式），显示最后修改时间戳
Image Block: 显示缩略图（100x100），悬停显示完整路径，点击"打开"用系统默认程序查看
File Link Block: 显示文件图标（根据扩展名）+ 文件名 + 文件大小，点击直接ShellExecute打开
5.4 审稿管理界面
时间轴视图:
plain
复制
[投稿]──[收到意见]──[修回]──[接收]
   │          │         │      │
   └─日期    └─意见列表 └─修改  └─状态
审稿意见卡片:
顶部: Reviewer 1 | Major | 建议修改: Results
中部: 原始意见文本（只读）
底部:
状态切换（待处理/修改中/已完成）
修改描述输入框
"关联修改内容"按钮（链接到ContentBlocks）
6. 功能实现清单（按优先级）
P0 - 核心基础（MVP）
数据库初始化
创建SQLite数据库（如不存在）
执行Schema.sql创建所有表
初始化示例数据（可选）
文章创建向导
模态对话框收集4个研究问题
创建Article + ResearchContext
自动生成7个Section skeleton
基于"Approach"自动生成初步任务清单（如"准备Methods图表"、"撰写Results第1段"）
章节编辑器
左侧TreeView显示7个Section
点击Section加载对应ContentBlocks
支持添加：
Text: 弹出输入框
Image: 文件选择器（复制到Attachments文件夹，数据库保存相对路径）
File Link: 文件选择器（仅保存路径，不复制）
双击File Link调用 Process.Start(new ProcessStartInfo(path) { UseShellExecute = true })
研究上下文查看
独立面板或弹窗显示4个问题的答案
支持编辑（UpdateAt更新时间戳）
P1 - MCP集成（核心卖点）
MCP Server实现
在应用启动时初始化MCP Server（stdio模式）
实现所有Resources的读取逻辑
实现所有Tools的写入逻辑（每次写入更新UpdatedAt时间戳，AI操作标记ModifiedBy="AI"）
提供配置界面生成 mcp.json 供用户复制到Cursor/Claude Code配置
MCP状态监控
系统托盘图标显示连接状态
日志窗口显示最近的MCP调用
P2 - 审稿工作流
投稿记录
添加"投稿"按钮，记录日期、期刊名、稿件号
创建新的ReviewRound
审稿意见录入
支持批量粘贴审稿意见（智能分割）
手动添加单条意见（Major/Minor分类）
修改追踪
每条意见关联到具体ContentBlocks（多选）
修改完成后记录时间戳
显示"本轮进度"（3/5已完成）
回复信生成
根据Completed的Revisions自动生成回复信模板（可导出）
P3 - 增强功能
导出功能
导出Markdown（按IMRaD顺序拼接所有Text Block）
导出Word（使用OpenXml，图片嵌入）
备份（打包.db + Attachments文件夹为.zip）
参考文献基础管理
简单列表（支持导入BibTeX）
拖拽PDF自动提取元数据（使用iTextSharp或PdfPig读取第一页尝试提取标题/作者）
全文搜索
搜索ContentBlock内容
搜索ResearchContext
7. 关键技术实现细节
7.1 本地文件链接打开
csharp
复制
// FileService.cs
public void OpenLocalFile(string relativePath)
{
    var fullPath = Path.Combine(ArticleFolder, relativePath);
    if (File.Exists(fullPath))
    {
        var psi = new ProcessStartInfo(fullPath)
        {
            UseShellExecute = true  // 关键：使用系统默认程序
        };
        Process.Start(psi);
    }
    else
    {
        // 显示错误：文件已移动或删除
    }
}
7.2 MCP Server初始化
csharp
复制
// McpServerService.cs
public async Task StartServerAsync()
{
    var server = new McpServer(new StdioServerTransport());
    
    // 注册Resources
    server.RegisterResourceHandler("scipaper://article/{id}/overview", async (uri) => {
        var articleId = ParseId(uri);
        var article = await _dbService.GetArticleAsync(articleId);
        return JsonConvert.SerializeObject(article);
    });
    
    // 注册Tools（示例：add_finding）
    server.RegisterToolHandler("add_finding", async (args) => {
        var articleId = Guid.Parse(args["article_id"]);
        var content = args["content"].ToString();
        
        // 获取Results章节
        var resultsSection = await _dbService.GetSectionAsync(articleId, SectionType.Results);
        
        // 添加ContentBlock
        var block = new ContentBlock {
            SectionId = resultsSection.Id,
            Type = BlockType.Text,
            Content = content,
            CreatedAt = DateTime.Now,
            ModifiedBy = "AI"
        };
        
        await _dbService.AddContentBlockAsync(block);
        
        // 如果有图片路径，添加Image Block
        if (args["image_paths"] != null) {
            foreach (var imgPath in args["image_paths"]) {
                // 复制到Attachments并添加Block
            }
        }
        
        return new { success = true, block_id = block.Id };
    });
    
    await server.StartAsync();
}
7.3 时间戳策略
所有实体必须实现：
csharp
复制
public interface ITimestamped
{
    DateTime CreatedAt { get; set; }
    DateTime UpdatedAt { get; set; }
}

// 在DbService中统一处理
public async Task UpdateAsync<T>(T entity) where T : ITimestamped
{
    entity.UpdatedAt = DateTime.Now;
    // ... 执行SQL更新
}
7.4 文件存储约定
csharp
复制
// 初始化文章文件夹
public void CreateArticleFolder(Guid articleId)
{
    var path = Path.Combine(_basePath, "Articles", articleId.ToString(), "Attachments");
    Directory.CreateDirectory(path);
}

// 保存附件（复制到Attachments）
public string SaveAttachment(Guid articleId, string sourcePath)
{
    var destDir = Path.Combine(_basePath, "Articles", articleId.ToString(), "Attachments");
    var fileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Path.GetFileName(sourcePath)}";
    var destPath = Path.Combine(destDir, fileName);
    File.Copy(sourcePath, destPath);
    return $"Attachments/{fileName}"; // 返回相对路径存入DB
}
8. 开发顺序建议（给Codex的迭代计划）
第1轮：基础架构（可独立测试）
创建WinUI 3项目
实现所有Model类
实现DatabaseService（SQLite连接、建表）
实现简单的Article列表页
第2轮：核心编辑功能（MVP）
实现创建向导（4个问题）
实现章节导航和内容编辑器
支持Text/Image/FileLink三种Block的CRUD
实现本地文件打开功能
第3轮：MCP集成（核心功能）
引入MCP SDK
实现McpServerService
实现所有Resources和Tools
添加MCP配置界面（生成JSON配置）
测试与Cursor/Claude Code的连接
第4轮：审稿工作流
实现ReviewRound和ReviewComment的数据库操作
创建审稿管理界面（时间轴+卡片）
实现修改与ContentBlocks的关联
生成回复信功能
第5轮：完善与导出
实现导出Markdown/Word
添加全文搜索
优化UI（添加Teaching Tips、快捷键）
打包为MSIX安装包
9. 用户配置示例（MCP）
当用户配置Cursor时，需要生成的配置：
JSON
复制
{
  "mcpServers": {
    "scipaper-todo": {
      "command": "C:\\Users\\{User}\\AppData\\Local\\SciPaperTodo\\SciPaperTodo.exe",
      "args": ["--mcp-server"],
      "env": {}
    }
  }
}
10. 命名约定
类名: PascalCase (e.g., ContentBlock, ReviewComment)
数据库表: 复数形式 (e.g., Articles, ContentBlocks)
枚举: 带类型后缀 (e.g., SectionType.Results)
文件路径存储: 相对路径（以Attachments/开头），绝对路径仅在运行时解析
时间戳字段: 统一命名 CreatedAt, UpdatedAt, CompletedAt, SubmittedAt
交付要求:
所有代码使用C#和WinUI 3实现
必须包含完整的错误处理和日志记录（使用Microsoft.Extensions.Logging）
UI文本支持中英文（使用x:Uid资源）
提供简单的Setup指南（如何安装和配置MCP）

## 2026-05-01：进度条目层 + 文件导入 + MCP 工具补全

### 数据模型新增（src/types.ts + electron/storage.cjs）
- `ProgressEntry`：科研进展条目，比 Section 细、比单次编辑明确。kind ∈ read/experiment/writing/idea/cite/analysis。必须挂 articleId，可选 sectionId/findingId/citationId/minutesSpent。
- `Finding`：Section.findings[]，主要用于 Results。是 Result 的子结论，可挂 ProgressEntry。status ∈ planned/inProgress/done。
- `DailySession`：date 主键。planText / summaryText / startedAt / endedAt / progressEntryIds[]。

readDatabase 兼容老库：sections.findings、progressEntries、dailySessions 都有 normalize fallback，缺失即空数组。

### MCP 工具新增（electron/llmTools.cjs + electron/toolRouter.cjs）
**查询类**：
- `find_article(query, status?, limit?)`：按标题/期刊模糊查找。任何写入前都应该先用它定位 articleId，不再凭对话猜文章名。
- `list_sections(articleId)`：返回各章节字数、块数、首句，比 get_article 轻得多。
- `get_section_summary(articleId, sectionType)`：单章节摘要 + 首末段截断。

**写入类**：
- `attach_file(articleId, sectionType, sourcePath, kind, description?)`：把本地绝对路径文件复制到 Attachments 并写一个 Image 或 FileLink 块。补上了之前 MCP 不能导入文件的空白。
- `add_progress_entry / list_progress_entries / update_progress_entry / delete_progress_entry / link_progress_to_finding`
- `add_finding / list_findings / update_finding / delete_finding`
- `start_daily_session / set_daily_plan / end_daily_session / get_daily_session`

`list_articles` 描述也改写了：去掉"返回范围较大、只在确实需要时使用"那行劝退话术，改为"任何写入或建议前先调用此工具确认 articleId"。这条原话术是模型不报论文名而直接猜的根因。

### UI 新增
- `HomeView`：第 4 个"今天开干"按钮，弹出 plan 输入弹窗（placeholder 从 28 条池里随机），可写可跳过。
- `DailyLogView`（新页面，sidebar 加 Daily Log 入口）：今日 plan + 快记入口（articleId / kind / title / detail）+ 时间线条目 + 收尾总结。
- `SectionEditor`：当 section.type === 'Results' 时顶部多一个 Findings 面板（增删改、状态切换）。
- `ShareCard`：版面改为"今日 N 项进展"为主，按 kind 分组列出条目（read/experiment/writing/idea/cite/analysis），字数降为其中一行。三个主题（claude/pixel/fresh）都跑通。

### 内置场景新增（electron/writingScenarios.cjs）
- `builtin-lab-log`：用户一句话描述今天做的事，AI 自动调 list_articles + add_progress_entry 写入。
- `builtin-daily-summary`：基于今日 ProgressEntry + 字数 + plan 起草一段收尾总结。

### 已知遗留
- `ItalicGuidePanel.tsx:39` 和 `global.d.ts:1` 仍有 pre-existing lint 错误（非本次引入），需要单独修。
