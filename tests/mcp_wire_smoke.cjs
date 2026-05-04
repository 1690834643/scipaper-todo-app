#!/usr/bin/env node
'use strict';

// Wire-level MCP smoke test: spawn the user's .exe with --mcp-server, list tools,
// and call a few tools/call. Validates that the binary actually serves MCP and
// that schemas advertise correctly. Pass EXE_PATH=... to override default.

const path = require('path');
const fs = require('fs');

// MCP_TARGET=cli  -> node electron/mcp-cli.cjs (default; works under WSL/Linux)
// MCP_TARGET=exe  -> Windows .exe with --mcp-server (only useful from Windows-native node)
// EXE_PATH=...    -> override the .exe path
const target = process.env.MCP_TARGET || 'cli';
const DEFAULT_EXE =
  '/mnt/c/Users/自动挡赛车手/AppData/Local/Temp/3D9eXV2NvBFOsUgPts86zAWKDEf/SciPaper Todo.exe';
const exePath = process.env.EXE_PATH || DEFAULT_EXE;

let command;
let args;
if (target === 'exe') {
  if (!fs.existsSync(exePath)) {
    console.error('EXE not found at: ' + exePath);
    process.exit(2);
  }
  command = exePath;
  args = ['--mcp-server'];
} else {
  command = process.execPath;
  args = [path.join(__dirname, '..', 'electron', 'mcp-cli.cjs')];
}

(async () => {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

  const transport = new StdioClientTransport({
    command,
    args,
    // 默认对外发布的 MCP 模式只暴露读工具；smoke test 想验证写工具
    // 也被 advertise，需要显式开启写 gate（仅本机测试用）。
    env: {
      ...process.env,
      SCIPAPER_MCP_CLIENT: 'wire-smoke',
      SCIPAPER_MCP_ALLOW_WRITE: '1',
    },
  });

  const client = new Client(
    { name: 'wire-smoke', version: '0.0.1' },
    { capabilities: { tools: {} } },
  );

  console.log('connecting to MCP server: ' + command + ' ' + args.join(' '));
  const t0 = Date.now();
  await client.connect(transport);
  console.log('connected in ' + (Date.now() - t0) + 'ms');

  const list = await client.listTools();
  const names = list.tools.map((t) => t.name).sort();
  console.log('tools advertised: ' + names.length);

  const expected = [
    // a few representative names from each domain
    'list_articles',
    'create_article',
    'export_article',
    'get_writing_streak',
    'set_theme',
    'list_scenarios',
    'get_italic_guide',
    'set_italic_guide',
    'get_zotero_config',
    'add_thesis_section',
    // Vocab pack registry (commit 3 of sprint 15)
    'list_vocab_packs',
    'set_vocab_pack_enabled',
    'import_vocab_pack',
    'delete_vocab_pack',
    'rename_vocab_pack',
    // Sprint 15.5
    'delete_article',
    'get_user_profile',
    'set_user_profile',
  ];
  const missing = expected.filter((n) => !names.includes(n));
  console.log('expected-set missing: ' + (missing.length ? missing.join(', ') : 'NONE'));

  // Exercise a few read-only tools through the wire.
  const probes = [
    ['get_theme', {}],
    ['get_italic_guide', {}],
    ['list_articles', {}],
    ['list_scenarios', {}],
    ['get_writing_stats', {}],
    ['list_vocab_packs', {}],
  ];

  const results = [];
  for (const [name, args] of probes) {
    try {
      const r = await client.callTool({ name, arguments: args });
      const text = r.content && r.content[0] && r.content[0].text;
      const preview = String(text || '').slice(0, 80).replace(/\n/g, ' ');
      results.push({ name, ok: !r.isError, preview });
    } catch (err) {
      results.push({ name, ok: false, preview: 'EXC: ' + err.message });
    }
  }
  console.log('\n--- wire-call probes ---');
  for (const r of results) {
    console.log(' ' + (r.ok ? '✓' : '✗') + ' ' + r.name.padEnd(22) + ' ' + r.preview);
  }

  const failed = results.filter((r) => !r.ok).length;
  await client.close();
  console.log(failed === 0 && missing.length === 0 ? '\nALL OK' : '\nFAILURES PRESENT');
  process.exit(failed === 0 && missing.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL:', e && e.stack || e);
  process.exit(2);
});
