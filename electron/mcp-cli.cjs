#!/usr/bin/env node
'use strict';

// Standalone MCP server entry — no Electron dependency.
//
// Use this when you want to run SciPaper Todo's MCP server without bringing
// up the Electron GUI (e.g. on Linux / WSL where the .exe isn't a clean
// stdio bridge, or in CI). Reads the same database under
// $HOME/Documents/SciPaperTodo/ — point HOME at a different folder for
// scratch / multi-profile setups.
//
// MCP client config:
//   {
//     "mcpServers": {
//       "scipaper-todo": {
//         "command": "node",
//         "args": ["/absolute/path/to/electron/mcp-cli.cjs"]
//       }
//     }
//   }

const { startMcpServer } = require('./mcp-server.cjs');

startMcpServer().catch((err) => {
  process.stderr.write('mcp-cli fatal: ' + (err && err.stack || err) + '\n');
  process.exit(1);
});
