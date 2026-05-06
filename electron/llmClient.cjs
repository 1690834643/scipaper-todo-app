const { TOOLS } = require('./llmTools.cjs');
const { runTool, validateArgs, summarizeForApproval } = require('./toolRouter.cjs');
const { buildSystemPrompt } = require('./llmSystemPrompt.cjs');

const sessions = new Map();

function getStorage() { return require('./storage.cjs'); }
function getKeyStore() { return require('./llmKeyStore.cjs'); }
function endpoint(baseUrl, path) { return String(baseUrl || '').replace(/\/+$/, '') + path; }
function send(mainWindow, channel, payload) {
  try {
    if (!mainWindow?.webContents) return;
    if (typeof mainWindow.isDestroyed === 'function' && mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(channel, payload);
  } catch {}
}
function sendEvent(mainWindow, payload) { send(mainWindow, 'llm:event', payload); }
function sendToolEvent(mainWindow, payload) { send(mainWindow, 'llm:toolEvent', payload); }
function isAbortError(error) { return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'; }
function abortError() { const error = new Error('aborted'); error.name = 'AbortError'; return error; }
function throwIfAborted(signal) { if (signal?.aborted) throw abortError(); }
function parseArgs(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function toJson(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? '' : serialized;
  } catch {
    return String(value);
  }
}
function normalizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((item) => item?.role === 'user' || item?.role === 'assistant')
    .map((item) => ({ role: item.role, content: String(item.content ?? item.text ?? '') }));
}
function buildMessages({ history, userMessage, tools, currentArticle, currentSection, activeScenario, italicGuide }) {
  const baseSystem = buildSystemPrompt({ tools, currentArticle, currentSection });
  const parts = [baseSystem];
  if (italicGuide?.enabled && italicGuide.prompt) {
    parts.push('\n\n【斜体规范】\n' + italicGuide.prompt);
  }
  if (activeScenario) {
    parts.push('\n\n' + activeScenario.systemPromptAddon);
  }
  return [
    { role: 'system', content: parts.join('') },
    ...normalizeHistory(history),
    { role: 'user', content: String(userMessage || '') },
  ];
}
function openAiTools(tools) {
  return tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}
function anthropicTools(tools) {
  return tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}
function appendAssistantToolMessage(kind, messages, text, toolCalls, reasoningContent) {
  if (kind === 'anthropic') {
    const content = text ? [{ type: 'text', text }] : [];
    for (const call of toolCalls) content.push({ type: 'tool_use', id: call.callId, name: call.name, input: call.args });
    messages.push({ role: 'assistant', content });
    return;
  }
  // DeepSeek V3.1+ thinking mode: server requires reasoning_content to be replayed in follow-up messages.
  // OpenAI-compat servers without thinking mode simply ignore the field.
  const message = {
    role: 'assistant',
    content: text || null,
    tool_calls: toolCalls.map((call) => ({ id: call.callId, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args || {}) } })),
  };
  if (reasoningContent) message.reasoning_content = reasoningContent;
  messages.push(message);
}
function appendToolResults(kind, messages, results) {
  if (kind === 'anthropic') {
    messages.push({
      role: 'user',
      content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.callId, content: toJson(r.result), is_error: !r.ok })),
    });
    return;
  }
  for (const r of results) messages.push({ role: 'tool', tool_call_id: r.callId, content: toJson(r.result) });
}
async function readLines(body, onLine) {
  if (!body) throw new Error('响应流为空');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) onLine(line);
  }
  buffer += decoder.decode();
  if (buffer) onLine(buffer);
}
async function readSseEvents(body, onEvent) {
  let eventName = '';
  let dataLines = [];
  function dispatch() {
    if (!dataLines.length) { eventName = ''; return; }
    const name = eventName, raw = dataLines.join('\n');
    eventName = ''; dataLines = [];
    try { onEvent(name, JSON.parse(raw)); } catch {}
  }
  await readLines(body, (line) => {
    if (line === '') dispatch();
    else if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  });
  dispatch();
}
function friendlyStatus(status) {
  if (status === 401 || status === 403) return 'API Key 无效或无权限';
  if (status === 429) return '速率限制，稍后再试';
  if (status >= 500) return '服务端错误';
  return '请求失败：HTTP ' + status;
}
async function ensureOk(response) {
  if (response.ok) return;
  let detail = '';
  try { detail = (await response.text()).slice(0, 300); } catch {}
  throw new Error(detail ? friendlyStatus(response.status) + '：' + detail : friendlyStatus(response.status));
}
async function callOpenAIStream(provider, apiKey, messages, tools, sessionId, mainWindow, abortSignal) {
  const body = { model: provider.model, messages, stream: true, temperature: provider.temperature ?? 0 };
  if (tools.length) { body.tools = openAiTools(tools); body.tool_choice = 'auto'; }
  if (provider.maxTokens && provider.maxTokens > 0) body.max_tokens = provider.maxTokens;
  const response = await fetch(endpoint(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  await ensureOk(response);

  let text = '';
  let reasoningContent = '';
  const accum = [];
  await readLines(response.body, (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let chunk;
    try { chunk = JSON.parse(data); } catch { return; }
    const delta = chunk.choices?.[0]?.delta || {};
    if (delta.reasoning_content) {
      reasoningContent += delta.reasoning_content;
      // Stream thinking-mode reasoning to UI as separate event so user can see model "thinking".
      // Renderer can choose whether to display.
      sendEvent(mainWindow, { sessionId, kind: 'textDelta', delta: '', reasoningDelta: delta.reasoning_content });
    }
    if (delta.content) {
      text += delta.content;
      sendEvent(mainWindow, { sessionId, kind: 'textDelta', delta: delta.content });
    }
    for (const item of delta.tool_calls || []) {
      const index = Number.isInteger(item.index) ? item.index : accum.length;
      const previous = accum[index] || { callId: 'call_' + index, name: '', argsRaw: '' };
      previous.callId = item.id || previous.callId;
      previous.name = item.function?.name || previous.name;
      previous.argsRaw += item.function?.arguments || '';
      accum[index] = previous;
    }
  });
  return {
    text,
    reasoningContent,
    toolCalls: accum.filter(Boolean).map((call, i) => ({
      callId: call.callId || 'call_' + i,
      name: call.name,
      args: parseArgs(call.argsRaw),
    })),
  };
}
function splitAnthropicMessages(messages) {
  return { system: messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n'), messages: messages.filter((m) => m.role !== 'system') };
}
async function callAnthropicStream(provider, apiKey, messages, tools, sessionId, mainWindow, abortSignal) {
  const split = splitAnthropicMessages(messages);
  const body = { model: provider.model, max_tokens: provider.maxTokens && provider.maxTokens > 0 ? provider.maxTokens : 4096, system: split.system, messages: split.messages, stream: true, temperature: provider.temperature ?? 0 };
  if (tools.length) body.tools = anthropicTools(tools);
  const response = await fetch(endpoint(provider.baseUrl, '/v1/messages'), {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
  await ensureOk(response);

  let text = '';
  const toolCalls = [];
  const blockToTool = new Map();
  let currentToolIndex = null;
  await readSseEvents(response.body, (eventName, payload) => {
    const event = eventName || payload.type;
    if (event === 'content_block_start') {
      const block = payload.content_block || {};
      const blockIndex = payload.index ?? toolCalls.length;
      if (block.type !== 'tool_use') { currentToolIndex = null; return; }
      currentToolIndex = toolCalls.length;
      blockToTool.set(blockIndex, currentToolIndex);
      toolCalls.push({ callId: block.id || 'tool_' + currentToolIndex, name: block.name || '', argsRaw: '' });
      return;
    }
    if (event !== 'content_block_delta') return;
    const delta = payload.delta || {};
    if (delta.type === 'text_delta' && delta.text) {
      text += delta.text;
      sendEvent(mainWindow, { sessionId, kind: 'textDelta', delta: delta.text });
    } else if (delta.type === 'input_json_delta') {
      const mapped = payload.index !== undefined ? blockToTool.get(payload.index) : currentToolIndex;
      if (mapped !== undefined && toolCalls[mapped]) toolCalls[mapped].argsRaw += delta.partial_json || '';
    }
  });
  return {
    text,
    toolCalls: toolCalls.map((call, i) => ({ callId: call.callId || 'tool_' + i, name: call.name, args: parseArgs(call.argsRaw) })),
  };
}
async function callLLMStream(provider, apiKey, messages, tools, sessionId, mainWindow, abortSignal) {
  if (provider.kind === 'openai-compat') return callOpenAIStream(provider, apiKey, messages, tools, sessionId, mainWindow, abortSignal);
  if (provider.kind === 'anthropic') return callAnthropicStream(provider, apiKey, messages, tools, sessionId, mainWindow, abortSignal);
  throw new Error('不支持的 Provider 协议');
}
async function waitForApproval(state, sessionId, callId, toolName, summary, args, mainWindow) {
  const approval = new Promise((resolve) => state.approvalPromises.set(callId, resolve));
  sendToolEvent(mainWindow, { sessionId, kind: 'askApproval', callId, toolName, summary, argsJson: JSON.stringify(args || {}, null, 2), args });
  return approval;
}

function shouldAutoApproveToolCall(definition, provider, state, globalAutoApprove) {
  if (!definition?.isWrite) return false;
  return Boolean(
    globalAutoApprove ||
    provider?.trustForWrite ||
    state?.alwaysAllow?.has(definition.name),
  );
}

async function executeToolCall(state, sessionId, toolCall, mainWindow, abortSignal, provider) {
  const name = toolCall.name;
  const args = toolCall.args || {};
  const callId = toolCall.callId;
  const summary = summarizeForApproval(name, args);
  const argsJson = JSON.stringify(args, null, 2);
  const definition = TOOLS.find((tool) => tool.name === name);
  if (!definition) {
    const result = { ok: false, error: '未知工具' };
    sendToolEvent(mainWindow, { sessionId, kind: 'result', callId, toolName: name, status: 'error', summary, argsJson, result });
    return { callId, ok: false, result };
  }
  const validation = validateArgs(name, args);
  if (!validation.valid) {
    const result = { ok: false, error: validation.errors.join('; ') };
    sendToolEvent(mainWindow, { sessionId, kind: 'result', callId, toolName: name, status: 'error', summary, argsJson, result });
    return { callId, ok: false, result };
  }
  throwIfAborted(abortSignal);
  let autoApproveAll = false;
  try { autoApproveAll = Boolean(getStorage().getAutoApproveTools && getStorage().getAutoApproveTools()); } catch {}
  const autoApproved = shouldAutoApproveToolCall(definition, provider, state, autoApproveAll);
  if (definition.isWrite && !autoApproved) {
    const decision = await waitForApproval(state, sessionId, callId, name, summary, args, mainWindow);
    state.approvalPromises.delete(callId);
    throwIfAborted(abortSignal);
    if (!decision?.approved) {
      const result = { ok: false, error: '用户拒绝' };
      sendToolEvent(mainWindow, { sessionId, kind: 'result', callId, toolName: name, status: 'error', summary, argsJson, result });
      return { callId, ok: false, result };
    }
    if (decision.alwaysAllow) state.alwaysAllow.add(name);
  } else if (definition.isWrite && autoApproved) {
    sendToolEvent(mainWindow, { sessionId, kind: 'autoApproved', callId, toolName: name, summary, argsJson, args });
  }
  const response = await runTool(name, args);
  const ok = Boolean(response?.ok);
  const result = ok ? response.result : { ok: false, error: response?.error || '工具执行失败' };
  sendToolEvent(mainWindow, { sessionId, kind: 'result', callId, toolName: name, status: ok ? 'success' : 'error', summary, argsJson, result });
  return { callId, ok, result };
}
async function startChat({ providerId, sessionId, userMessage, history, currentArticle, currentSection, mainWindow, scenarioId }) {
  let state = null;
  try {
    const provider = (getStorage().listProviders().providers || []).find((p) => p.id === providerId);
    if (!provider) return { ok: false, error: 'Provider not found' };
    const apiKey = getKeyStore().getKey(providerId);
    if (!apiKey || !String(apiKey).trim()) return { ok: false, error: 'API Key 未配置或无法解密' };

    cancelSession(sessionId);
    state = { abortController: new AbortController(), approvalPromises: new Map(), alwaysAllow: new Set(), toolCallTotal: 0, messages: [] };
    sessions.set(sessionId, state);
    // Single-block-per-section policy: when the current section already has
    // a text block (currentBlockId set), strip add_text_block from the tool
    // list so the AI can't create a second block. The AI must use
    // update_text_block to append/rewrite the existing one.
    const fullTools = provider.supportsToolUse === false ? [] : TOOLS;
    const tools = currentSection?.currentBlockId
      ? fullTools.filter((t) => t.name !== 'add_text_block')
      : fullTools;
    const storage = getStorage();
    const scenarios = storage.listWritingScenarios ? storage.listWritingScenarios() : [];
    const italicGuide = storage.getItalicGuide ? storage.getItalicGuide() : null;

    let activeScenario = null;
    const sectionType = currentSection?.type;
    if (scenarioId && scenarioId !== 'auto' && scenarioId !== 'off') {
      activeScenario = scenarios.find(s => s.id === scenarioId && s.enabled);
    } else if (scenarioId !== 'off' && sectionType) {
      activeScenario = scenarios.find(s => s.enabled && s.triggerSection === sectionType);
      if (!activeScenario) activeScenario = scenarios.find(s => s.enabled && s.triggerSection === 'any');
    }

    state.messages = buildMessages({ history, userMessage, tools, currentArticle, currentSection, activeScenario, italicGuide });

    while (state.toolCallTotal < 50) {
      throwIfAborted(state.abortController.signal);
      const streamed = await callLLMStream(provider, apiKey, state.messages, tools, sessionId, mainWindow, state.abortController.signal);
      if (!streamed.toolCalls.length) {
        state.messages.push({ role: 'assistant', content: streamed.text || '' });
        break;
      }
      appendAssistantToolMessage(provider.kind, state.messages, streamed.text, streamed.toolCalls, streamed.reasoningContent);
      const results = [];
      for (const toolCall of streamed.toolCalls) {
        if (state.toolCallTotal >= 50) break;
        state.toolCallTotal += 1;
        results.push(await executeToolCall(state, sessionId, toolCall, mainWindow, state.abortController.signal, provider));
      }
      if (results.length) appendToolResults(provider.kind, state.messages, results);
      if (state.toolCallTotal >= 50) {
        sendEvent(mainWindow, { sessionId, kind: 'limit', message: '工具调用次数达到上限 50，会话停止' });
        break;
      }
    }
    return { ok: true };
  } catch (error) {
    if (isAbortError(error)) return { ok: true };
    const message = error?.message || 'LLM 调用失败';
    sendEvent(mainWindow, { sessionId, kind: 'error', error: message });
    return { ok: false, error: message };
  } finally {
    if (state && sessions.get(sessionId) === state) {
      for (const resolve of state.approvalPromises.values()) resolve({ approved: false, alwaysAllow: false });
      sessions.delete(sessionId);
      sendEvent(mainWindow, { sessionId, kind: 'done' });
    }
  }
}
function resolveApproval(sessionId, callId, approved, alwaysAllow) {
  const state = sessions.get(sessionId);
  const resolve = state?.approvalPromises.get(callId);
  if (!resolve) return;
  state.approvalPromises.delete(callId);
  resolve({ approved: Boolean(approved), alwaysAllow: Boolean(alwaysAllow) });
}
function cancelSession(sessionId) {
  const state = sessions.get(sessionId);
  if (!state) return;
  state.abortController.abort();
  for (const resolve of state.approvalPromises.values()) resolve({ approved: false, alwaysAllow: false });
  state.approvalPromises.clear();
}
function testRequest(provider, apiKey, signal) {
  if (provider.kind === 'anthropic') {
    return fetch(endpoint(provider.baseUrl, '/v1/messages'), {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: provider.model, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }], stream: false, temperature: provider.temperature ?? 0 }),
      signal,
    });
  }
  if (provider.kind !== 'openai-compat') throw new Error('不支持的 Provider 协议');
  return fetch(endpoint(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({ model: provider.model, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }], stream: false, temperature: provider.temperature ?? 0 }),
    signal,
  });
}
async function testProvider(providerId) {
  let timeout = null;
  let provider = null;
  try {
    provider = (getStorage().listProviders().providers || []).find((p) => p.id === providerId);
    if (!provider) return { ok: false, message: 'Provider 未找到' };
    const apiKey = getKeyStore().getKey(providerId);
    if (!apiKey || !String(apiKey).trim()) return { ok: false, message: 'API Key 未配置或无法解密' };
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 10000);
    const response = await testRequest(provider, apiKey, controller.signal);
    return response.ok ? { ok: true, message: '连接正常' } : { ok: false, message: friendlyStatus(response.status) };
  } catch (error) {
    if (isAbortError(error)) return { ok: false, message: '连接超时' };
    if (error?.message === '不支持的 Provider 协议') return { ok: false, message: error.message };
    return { ok: false, message: '无法连接到 ' + (provider?.baseUrl || '') };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function simpleComplete({ providerId, system, userMessage, signal, maxTokens }) {
  const list = getStorage().listProviders();
  const targetId = providerId || list.activeId;
  const provider = (list.providers || []).find((p) => p.id === targetId);
  if (!provider) throw new Error('Provider not found');
  const apiKey = getKeyStore().getKey(provider.id);
  if (!apiKey || !String(apiKey).trim()) throw new Error('API Key 未配置或无法解密');
  const cap = Math.min(maxTokens || 8000, provider.maxTokens && provider.maxTokens > 0 ? provider.maxTokens : 8000);

  if (provider.kind === 'anthropic') {
    const response = await fetch(endpoint(provider.baseUrl, '/v1/messages'), {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: cap,
        system: String(system || ''),
        messages: [{ role: 'user', content: String(userMessage || '') }],
        temperature: 0.1,
      }),
      signal,
    });
    await ensureOk(response);
    const data = await response.json();
    const block = Array.isArray(data?.content) ? data.content.find((c) => c.type === 'text') : null;
    return block?.text || '';
  }
  if (provider.kind !== 'openai-compat') throw new Error('不支持的 Provider 协议');
  const response = await fetch(endpoint(provider.baseUrl, '/chat/completions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: provider.model,
      max_tokens: cap,
      messages: [
        { role: 'system', content: String(system || '') },
        { role: 'user', content: String(userMessage || '') },
      ],
      temperature: 0.1,
      stream: false,
    }),
    signal,
  });
  await ensureOk(response);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

// Same as simpleComplete but accepts a `history` array so we can keep a
// running conversation. Tools are NOT exposed — this is the "AI helper that
// can never edit your document" path used by the focus-mode rail chat.
module.exports = {
  startChat,
  resolveApproval,
  cancelSession,
  testProvider,
  simpleComplete,
  shouldAutoApproveToolCall,
  __test: { executeToolCall },
};
