const { safeStorage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const keyDir = path.join(os.homedir(), 'Documents', 'SciPaperTodo', 'keys');
const providerIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const encryptionUnavailableMessage =
  '系统未启用加密钥匙串,无法保存 API Key (可能在 WSL 或无 keychain 环境)';

// ---- Packaged-build detection --------------------------------------------
// Plaintext fallback is for DEV ONLY. In a packaged release we hard-refuse
// (current behavior), so end users never accidentally leak production keys.
let isPackagedBuild = false;
try { isPackagedBuild = Boolean(require('electron').app && require('electron').app.isPackaged); } catch {}

function plaintextFallbackAllowed() {
  if (isPackagedBuild) return false;
  // Opt-out: set SCIPAPER_STRICT_KEYS=1 to disable plaintext fallback even in dev.
  return process.env.SCIPAPER_STRICT_KEYS !== '1';
}

let warnedFallbackOnce = false;
function warnPlaintextFallback() {
  if (warnedFallbackOnce) return;
  warnedFallbackOnce = true;
  console.warn(
    '\n========================================================================\n' +
    '[llmKeyStore] safeStorage 不可用（可能在 WSL / 无 keychain Linux 环境）。\n' +
    '[llmKeyStore] DEV 模式降级：API Key 将以明文存到\n' +
    '[llmKeyStore]   ' + keyDir + '/{providerId}.plaintext\n' +
    '[llmKeyStore]\n' +
    '[llmKeyStore] ⚠️  仅限本机开发使用！请勿在此模式下配置真实生产 API Key。\n' +
    '[llmKeyStore] 打包后的 release 自动禁用此降级；要在 dev 也禁用，\n' +
    '[llmKeyStore] 设环境变量 SCIPAPER_STRICT_KEYS=1 即可。\n' +
    '========================================================================\n',
  );
}

function validateProviderId(providerId) {
  if (typeof providerId !== 'string' || !providerIdPattern.test(providerId)) {
    throw new Error('invalid provider id');
  }
}

function getEncryptedKeyPath(providerId) {
  return path.join(keyDir, `${providerId}.bin`);
}
function getPlaintextKeyPath(providerId) {
  return path.join(keyDir, `${providerId}.plaintext`);
}

function ensureKeyDir() {
  fs.mkdirSync(keyDir, { recursive: true });
}

function isEncryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch (error) {
    return false;
  }
}

function setKey(providerId, plaintext) {
  validateProviderId(providerId);
  ensureKeyDir();

  if (isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(plaintext);
    fs.writeFileSync(getEncryptedKeyPath(providerId), encrypted);
    // If a stale plaintext key exists from an earlier dev session, drop it
    // now that we have a properly-encrypted version.
    try { fs.unlinkSync(getPlaintextKeyPath(providerId)); } catch {}
    return;
  }

  if (!plaintextFallbackAllowed()) {
    throw new Error(encryptionUnavailableMessage);
  }

  warnPlaintextFallback();
  // 0o600: owner read/write only — best effort on Windows/WSL where POSIX
  // perms are weak, but still meaningful on real Linux.
  fs.writeFileSync(getPlaintextKeyPath(providerId), String(plaintext), { mode: 0o600 });
}

function getKey(providerId) {
  validateProviderId(providerId);

  if (isEncryptionAvailable()) {
    try {
      const encrypted = fs.readFileSync(getEncryptedKeyPath(providerId));
      return safeStorage.decryptString(encrypted);
    } catch {
      // Fall through to plaintext check below — useful if user wrote a
      // plaintext key in WSL and now reads it from a context where
      // safeStorage works (rare, but harmless).
    }
  }

  if (plaintextFallbackAllowed()) {
    try {
      const text = fs.readFileSync(getPlaintextKeyPath(providerId), 'utf8');
      if (text && text.trim()) {
        warnPlaintextFallback();
        return text;
      }
    } catch {}
  }

  return null;
}

function deleteKey(providerId) {
  validateProviderId(providerId);
  for (const filePath of [getEncryptedKeyPath(providerId), getPlaintextKeyPath(providerId)]) {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
}

function hasKey(providerId) {
  validateProviderId(providerId);
  if (fs.existsSync(getEncryptedKeyPath(providerId))) return true;
  if (plaintextFallbackAllowed() && fs.existsSync(getPlaintextKeyPath(providerId))) return true;
  return false;
}

/** Surface storage mode + warning text so the UI can flag plaintext keys. */
function getStorageInfo() {
  const encryptionOn = isEncryptionAvailable();
  const fallbackOn = !encryptionOn && plaintextFallbackAllowed();
  return {
    mode: encryptionOn ? 'safeStorage' : fallbackOn ? 'plaintext' : 'unavailable',
    keyDir,
    isPackaged: isPackagedBuild,
    warning: fallbackOn
      ? 'API Key 当前以明文存储（DEV 模式降级，仅限本机开发）。'
      : !encryptionOn
        ? 'API Key 加密钥匙串不可用，且明文降级被禁用，无法保存 Key。'
        : null,
  };
}

module.exports = {
  setKey,
  getKey,
  deleteKey,
  hasKey,
  getStorageInfo,
};
