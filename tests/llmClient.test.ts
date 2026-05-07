import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const llmClientPath = require.resolve('../electron/llmClient.cjs')
const toolRouterPath = require.resolve('../electron/toolRouter.cjs')
const storagePath = require.resolve('../electron/storage.cjs')

let tempHomes: string[] = []

function loadLlmClient(home = fs.mkdtempSync(path.join(os.tmpdir(), 'scipaper-llm-'))) {
  process.env.HOME = home
  tempHomes.push(home)
  delete require.cache[llmClientPath]
  delete require.cache[toolRouterPath]
  delete require.cache[storagePath]
  return require('../electron/llmClient.cjs')
}

afterEach(() => {
  delete require.cache[llmClientPath]
  delete require.cache[toolRouterPath]
  delete require.cache[storagePath]
  for (const home of tempHomes) {
    fs.rmSync(home, { force: true, recursive: true })
  }
  tempHomes = []
})

describe('llmClient write approval policy', () => {
  it('auto-approves write tools for trusted providers without enabling the global switch', () => {
    const llmClient = loadLlmClient()
    const state = { alwaysAllow: new Set<string>() }
    const definition = { name: 'update_text_block', isWrite: true }
    const provider = { id: 'trusted-provider', trustForWrite: true }

    expect(llmClient.shouldAutoApproveToolCall(definition, provider, state, false)).toBe(true)
  })

  it('does not auto-approve write tools for untrusted providers when no override is active', () => {
    const llmClient = loadLlmClient()
    const state = { alwaysAllow: new Set<string>() }
    const definition = { name: 'update_text_block', isWrite: true }
    const provider = { id: 'untrusted-provider', trustForWrite: false }

    expect(llmClient.shouldAutoApproveToolCall(definition, provider, state, false)).toBe(false)
  })

  it('never auto-approves irreversible delete tools even for trusted providers or global auto-approve', () => {
    const llmClient = loadLlmClient()
    const state = { alwaysAllow: new Set<string>(['delete_article']) }
    const definition = { name: 'delete_article', isWrite: true }
    const provider = { id: 'trusted-provider', trustForWrite: true }

    expect(llmClient.shouldAutoApproveToolCall(definition, provider, state, true)).toBe(false)
  })

  it('emits autoApproved and completes trusted provider write calls without asking', async () => {
    const llmClient = loadLlmClient()
    const events: Array<{ channel: string; payload: Record<string, unknown> }> = []
    const mainWindow = {
      isDestroyed: () => false,
      webContents: {
        send: (channel: string, payload: Record<string, unknown>) => events.push({ channel, payload }),
      },
    }
    const state = { approvalPromises: new Map(), alwaysAllow: new Set<string>() }

    const result = await llmClient.__test.executeToolCall(
      state,
      'session-1',
      { callId: 'call-1', name: 'set_theme', args: { theme: 'fresh' } },
      mainWindow,
      new AbortController().signal,
      { id: 'trusted-provider', trustForWrite: true },
    )

    expect(result.ok).toBe(true)
    expect(events.some((event) => event.payload.kind === 'askApproval')).toBe(false)
    expect(events.some((event) => event.payload.kind === 'autoApproved')).toBe(true)
    expect(events.some((event) => event.payload.kind === 'result' && event.payload.status === 'success')).toBe(true)
    expect(state.approvalPromises.size).toBe(0)
  })
})
