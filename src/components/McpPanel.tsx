import type { McpInfo } from '../types'
import { useMemo, useState } from 'react'

interface McpPanelProps {
  info: McpInfo | null
}

type McpPresetKey =
  | 'cursor'
  | 'claudeCode'
  | 'claudeDesktop'
  | 'vscode'
  | 'cline'
  | 'rooCode'
  | 'kimiCode'
  | 'windsurf'
  | 'continueDev'
  | 'generic'
  | 'guiBinary'

const MCP_PRESETS: Array<{
  key: McpPresetKey
  label: string
  target: string
  note: string
  configHint: string
}> = [
  {
    key: 'cursor',
    label: 'Cursor',
    target: 'Cursor Settings -> MCP',
    note: '推荐桌面端写作和代码助手使用，写入来源会显示为 Cursor。',
    configHint: '把 JSON 粘到 Cursor 的 MCP 配置里。',
  },
  {
    key: 'claudeCode',
    label: 'Claude Code',
    target: 'Claude Code MCP 配置',
    note: '适合在终端里直接让 AI 调用稿件库、审稿和附件工具。',
    configHint: '添加到 Claude Code 当前项目或全局 MCP 配置。',
  },
  {
    key: 'claudeDesktop',
    label: 'Claude Desktop',
    target: 'claude_desktop_config.json',
    note: '适合桌面聊天式使用，保持 SciPaper Todo 已启动即可同步刷新。',
    configHint: '把 `mcpServers` 合并进 Claude Desktop 配置文件。',
  },
  {
    key: 'vscode',
    label: 'VS Code',
    target: 'VS Code MCP 扩展',
    note: '适合 VS Code 内的 MCP 客户端或支持 mcpServers 的扩展。',
    configHint: '将配置放入扩展要求的 MCP JSON 入口。',
  },
  {
    key: 'cline',
    label: 'Cline',
    target: 'Cline MCP Servers',
    note: '适合 Cline 侧边栏工作流，来源名会单独标记为 Cline。',
    configHint: '在 Cline 的 MCP Servers 设置中添加该服务。',
  },
  {
    key: 'rooCode',
    label: 'Roo Code',
    target: 'Roo Code MCP Servers',
    note: '适合 Roo Code 多模式代理使用，来源名会单独标记。',
    configHint: '在 Roo Code 的 MCP 设置中添加该 JSON。',
  },
  {
    key: 'kimiCode',
    label: 'Kimi Code',
    target: 'Kimi Code MCP 配置',
    note: '适合在 Kimi Code 里直接调用稿件、审稿、附件和导入工具，来源会显示为 Kimi Code。',
    configHint: '在 Kimi Code 的 MCP servers 配置中添加该服务。',
  },
  {
    key: 'windsurf',
    label: 'Windsurf',
    target: 'Windsurf MCP 配置',
    note: '适合 Windsurf 编辑器内的 MCP 工具调用。',
    configHint: '把服务配置合并到 Windsurf 的 MCP servers 配置。',
  },
  {
    key: 'continueDev',
    label: 'Continue',
    target: 'Continue MCP 配置',
    note: '适合 Continue 工作流；不同版本入口名称可能不同，服务本身使用标准 stdio。',
    configHint: '在 Continue 支持的 MCP servers 配置位置添加该服务。',
  },
  {
    key: 'generic',
    label: '通用 MCP JSON',
    target: '任何支持 stdio MCP 的客户端',
    note: '不确定客户端格式时用这个，关键是保留 command、args 和 env。',
    configHint: '把 `mcpServers.scipaper-todo` 合并到客户端配置。',
  },
  {
    key: 'guiBinary',
    label: 'GUI 二进制备用',
    target: '无法调用当前进程路径时',
    note: '备用方案，优先使用前面的标准配置。',
    configHint: '只有标准配置不可用时再尝试。',
  },
]

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function McpPanel({ info }: McpPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<McpPresetKey>('cursor')
  const selected = useMemo(
    () => MCP_PRESETS.find((preset) => preset.key === selectedPreset) ?? MCP_PRESETS[0],
    [selectedPreset],
  )

  if (!info) {
    return (
      <section className="empty-panel">
        <h3>MCP 信息加载失败</h3>
        <p>请重新启动应用后再试。</p>
      </section>
    )
  }

  const selectedConfig = info.examples?.[selected.key] ?? info.configJson
  const launchCommand = [info.command, ...info.args].map(shellQuote).join(' ')

  return (
    <div className="panel-stack">
      <section className="panel-card">
        <p className="eyebrow">MCP Bridge</p>
        <h3>连接主流 MCP 客户端</h3>
        <div className="plain-list">
          <p>命令路径: {info.command}</p>
          <p>启动参数: {info.args.join(' ')}</p>
          <p>本地数据目录: {info.baseDirectory}</p>
          <p>实时同步: MCP 写入后，应用会自动刷新，不需要重启。</p>
          <p>附件备份: 通过 MCP 写入的图片和文件会自动复制到文章目录下的 Attachments。</p>
        </div>
        <div className="header-actions" style={{ marginTop: 'var(--sp-3)' }}>
          <button className="ghost-button" type="button" onClick={() => window.scipaper.copyText(launchCommand)}>
            复制启动命令
          </button>
          <code style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-ink-muted)', wordBreak: 'break-all' }}>
            {launchCommand}
          </code>
        </div>
      </section>

      <section className="panel-card">
        <p className="eyebrow">使用步骤</p>
        <h3>推荐接入方式</h3>
        <div className="revision-list">
          <div className="revision-item">
            <strong>1. 安装桌面版</strong>
            <p>先启动 SciPaper Todo，创建文章后再配置 MCP。这样本地目录和数据库会先初始化。</p>
          </div>
          <div className="revision-item">
            <strong>2. 复制配置</strong>
            <p>先选择你使用的工具，再把生成的 JSON 复制到对应 MCP 配置里。</p>
          </div>
          <div className="revision-item">
            <strong>3. 设置来源名</strong>
            <p>每个预设会自动设置 `SCIPAPER_MCP_CLIENT`，软件会在内容块里显示写入来源。</p>
          </div>
          <div className="revision-item">
            <strong>4. 开始写入</strong>
            <p>MCP 可读取研究上下文、章节内容、待处理审稿意见，也可追加文本、导入图片/PDF、记录审稿修改。</p>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MCP Client</p>
            <h3>选择配置目标</h3>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>客户端</span>
            <select value={selectedPreset} onChange={(event) => setSelectedPreset(event.target.value as McpPresetKey)}>
              {MCP_PRESETS.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>配置位置</span>
            <input value={selected.target} readOnly />
          </label>
        </div>
        <div className="revision-item" style={{ marginTop: 'var(--sp-3)' }}>
          <strong>{selected.label}</strong>
          <p>{selected.note}</p>
          <p>{selected.configHint}</p>
        </div>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">mcp.json</p>
            <h3>{selected.label} 配置</h3>
          </div>
          <button className="primary-button" onClick={() => window.scipaper.copyText(selectedConfig)} type="button">
            复制当前配置
          </button>
        </div>
        <pre className="code-block">{selectedConfig}</pre>
      </section>
    </div>
  )
}
