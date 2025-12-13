/**
 * OAuth implementation for Anthropic API keys and Claude Code
 * Implements PKCE flow with token refresh and API key creation
 */

const crypto = require('crypto')
const http = require('http')
const { app, safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')

// OAuth Constants
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const AUTHORIZATION_ENDPOINT_MAX = 'https://claude.ai/oauth/authorize'
const AUTHORIZATION_ENDPOINT_CONSOLE = 'https://console.anthropic.com/oauth/authorize'
const TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token'
// Use local callback for Claude Code OAuth (like open-claude-code does)
const REDIRECT_PORT = 54545
const REDIRECT_URI_LOCAL = `http://localhost:${REDIRECT_PORT}/callback`
// Fallback to hosted callback for manual code entry
const REDIRECT_URI_HOSTED = 'https://console.anthropic.com/oauth/code/callback'
const CREATE_API_KEY_ENDPOINT = 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key'
const SCOPES = 'org:create_api_key user:profile user:inference'

// Store PKCE verifier temporarily during OAuth flow
let currentPKCEVerifier = null
// Store OAuth state for CSRF protection
let currentState = null
// Store callback server
let callbackServer = null
// Store callback promise resolver
let callbackResolver = null
// Lock for token refresh to prevent concurrent refreshes
let refreshInProgress = null

/**
 * Get the config file path
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'oauth-config.json')
}

/**
 * Check if safeStorage encryption is available
 */
function isEncryptionAvailable() {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Encrypt a string using OS-level secure storage
 * Returns base64-encoded encrypted data, or original string if encryption unavailable
 */
function encryptString(plaintext) {
  if (!plaintext) return null
  if (!isEncryptionAvailable()) {
    console.warn('[OAuth] Encryption not available, storing unencrypted')
    return { encrypted: false, data: plaintext }
  }
  try {
    const buffer = safeStorage.encryptString(plaintext)
    return { encrypted: true, data: buffer.toString('base64') }
  } catch (error) {
    console.error('[OAuth] Encryption failed:', error)
    return { encrypted: false, data: plaintext }
  }
}

/**
 * Decrypt a string that was encrypted with encryptString
 */
function decryptString(encryptedData) {
  if (!encryptedData) return null

  // Handle both old unencrypted format and new encrypted format
  if (typeof encryptedData === 'string') {
    // Old format - plain string (backwards compatible)
    return encryptedData
  }

  if (!encryptedData.encrypted) {
    // Stored unencrypted
    return encryptedData.data
  }

  if (!isEncryptionAvailable()) {
    console.error('[OAuth] Cannot decrypt - encryption not available')
    return null
  }

  try {
    const buffer = Buffer.from(encryptedData.data, 'base64')
    return safeStorage.decryptString(buffer)
  } catch (error) {
    console.error('[OAuth] Decryption failed:', error)
    return null
  }
}

/**
 * Load OAuth config from file (async for non-blocking I/O)
 * PERFORMANCE: Uses fs.promises to avoid blocking the Electron main thread
 */
async function loadOAuthConfig() {
  try {
    const configPath = getConfigPath()
    const data = await fs.promises.readFile(configPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - not an error
      return {}
    }
    console.error('Failed to load OAuth config:', error)
    return {}
  }
}

/**
 * Synchronous version for startup/critical paths only
 * @deprecated Prefer loadOAuthConfig() for non-blocking operation
 */
function loadOAuthConfigSync() {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Failed to load OAuth config:', error)
  }
  return {}
}

/**
 * Save OAuth config to file (async for non-blocking I/O)
 * PERFORMANCE: Uses fs.promises to avoid blocking the Electron main thread
 */
async function saveOAuthConfig(config) {
  try {
    const configPath = getConfigPath()
    // Ensure directory exists
    const dir = path.dirname(configPath)
    await fs.promises.mkdir(dir, { recursive: true })
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save OAuth config:', error)
  }
}

/**
 * Generate PKCE challenge and verifier for secure OAuth flow
 */
function generatePKCEChallenge() {
  // Generate 32 bytes of random data and encode as base64url
  const verifier = crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Create SHA-256 hash of verifier and encode as base64url
  const challenge = crypto.createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Generate separate state for CSRF protection (independent from PKCE)
  const state = crypto.randomBytes(16).toString('hex')

  return { challenge, verifier, state }
}

/**
 * Generate the OAuth authorization URL
 * @param {'max' | 'console'} mode - 'max' for Claude Pro/Max, 'console' for Console API
 * @param {Object} pkce - The PKCE challenge object
 * @param {boolean} useLocalCallback - Whether to use local callback server (default: true)
 */
function getAuthorizationUrl(mode, pkce, useLocalCallback = true) {
  const baseUrl = mode === 'max' ? AUTHORIZATION_ENDPOINT_MAX : AUTHORIZATION_ENDPOINT_CONSOLE
  const redirectUri = useLocalCallback ? REDIRECT_URI_LOCAL : REDIRECT_URI_HOSTED
  const url = new URL(baseUrl)

  url.searchParams.set('code', 'true')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('code_challenge', pkce.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', pkce.state)

  return url.toString()
}

/**
 * Exchange authorization code for access and refresh tokens
 * @param {string} code - The authorization code
 * @param {string} verifier - The PKCE verifier
 * @param {string|null} state - The state parameter from callback
 * @param {boolean} useLocalCallback - Whether local callback was used (default: true)
 */
async function exchangeCodeForTokens(code, verifier, state = null, useLocalCallback = true) {
  try {
    const redirectUri = useLocalCallback ? REDIRECT_URI_LOCAL : REDIRECT_URI_HOSTED

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        state: state,
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        code_verifier: verifier
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to exchange code for tokens:', response.status, response.statusText)
      console.error('Error response:', errorText)
      return null
    }

    const json = await response.json()

    return {
      type: 'oauth',
      refresh: json.refresh_token,
      access: json.access_token,
      expires: Date.now() + json.expires_in * 1000
    }
  } catch (error) {
    console.error('Error exchanging code for tokens:', error)
    return null
  }
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(refreshToken) {
  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID
      })
    })

    if (!response.ok) {
      console.error('Failed to refresh access token:', response.statusText)
      return null
    }

    const json = await response.json()

    return {
      type: 'oauth',
      refresh: json.refresh_token,
      access: json.access_token,
      expires: Date.now() + json.expires_in * 1000
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return null
  }
}

/**
 * Create an API key using OAuth credentials
 */
async function createApiKey(accessToken) {
  try {
    const response = await fetch(CREATE_API_KEY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create API key:', response.status, response.statusText)
      console.error('Error response:', errorText)
      return null
    }

    const json = await response.json()
    return json.raw_key
  } catch (error) {
    console.error('Error creating API key:', error)
    return null
  }
}

/**
 * Save OAuth tokens to config with encryption
 * PERFORMANCE: Now async to avoid blocking main thread
 */
async function saveOAuthTokens(tokens) {
  const config = await loadOAuthConfig()
  // Encrypt sensitive token data
  config.oauthTokens = {
    type: tokens.type,
    refresh: encryptString(tokens.refresh),
    access: encryptString(tokens.access),
    expires: tokens.expires
  }
  await saveOAuthConfig(config)
}

/**
 * Get OAuth tokens from config with decryption
 * PERFORMANCE: Now async to avoid blocking main thread
 */
async function getOAuthTokens() {
  const config = await loadOAuthConfig()
  const tokens = config.oauthTokens
  if (!tokens) return null

  // Decrypt sensitive token data
  const refresh = decryptString(tokens.refresh)
  const access = decryptString(tokens.access)

  // If decryption failed, tokens are invalid
  if (!refresh || !access) {
    console.error('[OAuth] Failed to decrypt tokens')
    return null
  }

  return {
    type: tokens.type,
    refresh,
    access,
    expires: tokens.expires
  }
}

/**
 * Remove OAuth tokens from config
 * PERFORMANCE: Now async to avoid blocking main thread
 */
async function clearOAuthTokens() {
  const config = await loadOAuthConfig()
  delete config.oauthTokens
  await saveOAuthConfig(config)
}

/**
 * Save Claude Code API key to config with encryption
 * PERFORMANCE: Now async to avoid blocking main thread
 */
async function saveClaudeCodeApiKey(apiKey) {
  const config = await loadOAuthConfig()
  config.claudeCodeApiKey = encryptString(apiKey)
  await saveOAuthConfig(config)
}

/**
 * Get Claude Code API key from config with decryption
 * PERFORMANCE: Now async to avoid blocking main thread
 */
async function getClaudeCodeApiKey() {
  const config = await loadOAuthConfig()
  return decryptString(config.claudeCodeApiKey)
}

/**
 * Clear Claude Code API key from config
 * PERFORMANCE: Now async to avoid blocking main thread
 */
async function clearClaudeCodeApiKey() {
  const config = await loadOAuthConfig()
  delete config.claudeCodeApiKey
  await saveOAuthConfig(config)
}

/**
 * Check if access token is expired or about to expire (within 5 minutes)
 */
function isTokenExpired(tokens) {
  const fiveMinutes = 5 * 60 * 1000
  return tokens.expires < Date.now() + fiveMinutes
}

/**
 * Get a valid access token, refreshing if necessary
 * Uses a lock to prevent concurrent refresh attempts
 */
async function getValidAccessToken() {
  const tokens = await getOAuthTokens()
  if (!tokens) {
    return null
  }

  if (isTokenExpired(tokens)) {
    // Check if a refresh is already in progress
    if (refreshInProgress) {
      console.log('Token refresh already in progress, waiting...')
      try {
        const result = await refreshInProgress
        return result
      } catch {
        // If the other refresh failed, we'll try again below
      }
    }

    // Start a new refresh with a lock
    console.log('Access token expired, refreshing...')
    refreshInProgress = (async () => {
      try {
        // Re-check tokens in case another caller just refreshed
        const currentTokens = await getOAuthTokens()
        if (currentTokens && !isTokenExpired(currentTokens)) {
          return currentTokens.access
        }

        const newTokens = await refreshAccessToken(tokens.refresh)
        if (!newTokens) {
          console.error('Failed to refresh token')
          return null
        }
        await saveOAuthTokens(newTokens)
        return newTokens.access
      } finally {
        // Clear the lock after refresh completes
        refreshInProgress = null
      }
    })()

    return refreshInProgress
  }

  return tokens.access
}

/**
 * Get the current PKCE verifier
 */
function getPKCEVerifier() {
  return currentPKCEVerifier
}

/**
 * Set the current PKCE verifier
 */
function setPKCEVerifier(verifier) {
  currentPKCEVerifier = verifier
}

/**
 * Clear the current PKCE verifier
 */
function clearPKCEVerifier() {
  currentPKCEVerifier = null
}

/**
 * Get the current OAuth state
 */
function getState() {
  return currentState
}

/**
 * Set the current OAuth state
 */
function setState(state) {
  currentState = state
}

/**
 * Clear the current OAuth state
 */
function clearState() {
  currentState = null
}

/**
 * Start local HTTP server to capture OAuth callback
 * Returns a promise that resolves with the authorization code
 */
function startCallbackServer() {
  return new Promise((resolve, reject) => {
    // Clean up any existing server
    if (callbackServer) {
      try {
        callbackServer.close()
      } catch (e) {
        // Ignore
      }
      callbackServer = null
    }

    callbackServer = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        // Send success HTML response
        res.writeHead(200, { 'Content-Type': 'text/html' })

        if (error) {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Cluso - Authentication Error</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                  }
                  .container {
                    text-align: center;
                    padding: 48px;
                    max-width: 420px;
                  }
                  .icon {
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-size: 32px;
                    animation: shake 0.5s ease-in-out;
                  }
                  @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-8px); }
                    75% { transform: translateX(8px); }
                  }
                  h1 {
                    font-size: 24px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                  }
                  p {
                    color: #a1a1aa;
                    font-size: 14px;
                    line-height: 1.6;
                    margin-bottom: 8px;
                  }
                  .error-detail {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 8px;
                    padding: 12px 16px;
                    margin: 16px 0;
                    font-size: 13px;
                    color: #fca5a5;
                  }
                  .logo {
                    font-size: 14px;
                    color: #525252;
                    margin-top: 32px;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">✕</div>
                  <h1>Authentication Failed</h1>
                  <div class="error-detail">${errorDescription || error}</div>
                  <p>Please close this window and try again.</p>
                  <div class="logo">Cluso</div>
                </div>
              </body>
            </html>
          `)

          // Clean up and reject
          setTimeout(() => {
            if (callbackServer) {
              callbackServer.close()
              callbackServer = null
            }
          }, 1000)

          reject(new Error(errorDescription || error))
        } else if (code) {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Cluso - Authentication Success</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                  }
                  .container {
                    text-align: center;
                    padding: 48px;
                    max-width: 420px;
                  }
                  .icon {
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-size: 32px;
                    animation: pop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                  }
                  @keyframes pop {
                    0% { transform: scale(0); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                  }
                  .checkmark {
                    animation: draw 0.5s ease-in-out 0.2s forwards;
                    stroke-dasharray: 50;
                    stroke-dashoffset: 50;
                  }
                  @keyframes draw {
                    to { stroke-dashoffset: 0; }
                  }
                  h1 {
                    font-size: 24px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                  }
                  p {
                    color: #a1a1aa;
                    font-size: 14px;
                    line-height: 1.6;
                  }
                  .closing {
                    margin-top: 24px;
                    padding: 12px 24px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    font-size: 13px;
                    color: #71717a;
                  }
                  .logo {
                    font-size: 14px;
                    color: #525252;
                    margin-top: 32px;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <polyline class="checkmark" points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <h1>Authentication Successful</h1>
                  <p>You're now connected to Claude.</p>
                  <div class="closing">This window will close automatically...</div>
                  <div class="logo">Cluso</div>
                </div>
                <script>setTimeout(() => window.close(), 2000)</script>
              </body>
            </html>
          `)

          // Clean up and resolve
          setTimeout(() => {
            if (callbackServer) {
              callbackServer.close()
              callbackServer = null
            }
          }, 1000)

          resolve({ code, state })
        } else {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Cluso - Authentication Error</title>
                <style>
                  * { margin: 0; padding: 0; box-sizing: border-box; }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                  }
                  .container {
                    text-align: center;
                    padding: 48px;
                    max-width: 420px;
                  }
                  .icon {
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-size: 32px;
                  }
                  h1 {
                    font-size: 24px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    background: linear-gradient(135deg, #fff 0%, #a1a1aa 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                  }
                  p {
                    color: #a1a1aa;
                    font-size: 14px;
                    line-height: 1.6;
                    margin-bottom: 8px;
                  }
                  .logo {
                    font-size: 14px;
                    color: #525252;
                    margin-top: 32px;
                    letter-spacing: 2px;
                    text-transform: uppercase;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="icon">?</div>
                  <h1>Something Went Wrong</h1>
                  <p>No authorization code was received.</p>
                  <p>Please close this window and try again.</p>
                  <div class="logo">Cluso</div>
                </div>
              </body>
            </html>
          `)

          reject(new Error('No authorization code received'))
        }
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    callbackServer.on('error', (err) => {
      console.error('[OAuth] Callback server error:', err)
      reject(err)
    })

    callbackServer.listen(REDIRECT_PORT, () => {
      console.log(`[OAuth] Callback server listening on port ${REDIRECT_PORT}`)
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      if (callbackServer) {
        callbackServer.close()
        callbackServer = null
        reject(new Error('OAuth callback timeout'))
      }
    }, 5 * 60 * 1000)
  })
}

/**
 * Stop the callback server if running
 */
function stopCallbackServer() {
  if (callbackServer) {
    try {
      callbackServer.close()
    } catch (e) {
      // Ignore
    }
    callbackServer = null
  }
}

/**
 * Get the redirect port for the local callback
 */
function getRedirectPort() {
  return REDIRECT_PORT
}

/**
 * Get the local redirect URI
 */
function getLocalRedirectUri() {
  return REDIRECT_URI_LOCAL
}

module.exports = {
  generatePKCEChallenge,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  createApiKey,
  saveOAuthTokens,
  getOAuthTokens,
  clearOAuthTokens,
  saveClaudeCodeApiKey,
  getClaudeCodeApiKey,
  clearClaudeCodeApiKey,
  isTokenExpired,
  getValidAccessToken,
  getPKCEVerifier,
  setPKCEVerifier,
  clearPKCEVerifier,
  getState,
  setState,
  clearState,
  startCallbackServer,
  stopCallbackServer,
  getRedirectPort,
  getLocalRedirectUri,
  isEncryptionAvailable,
}
