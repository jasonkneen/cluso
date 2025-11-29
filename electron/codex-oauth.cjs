/**
 * Codex OAuth implementation for OpenAI ChatGPT Plus/Pro
 * Implements PKCE flow with token refresh for Codex API access
 */

const crypto = require('crypto')
const http = require('http')
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

// Codex OAuth Constants (from openai/codex)
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize'
const TOKEN_URL = 'https://auth.openai.com/oauth/token'
const REDIRECT_PORT = 1455
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/auth/callback`
const SCOPE = 'openid profile email offline_access'

// API endpoints
const CODEX_BASE_URL = 'https://chatgpt.com/backend-api'

// Store PKCE verifier temporarily during OAuth flow
let currentPKCEVerifier = null
let currentState = null
// Store callback server
let callbackServer = null

/**
 * Get the config file path
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'codex-oauth-config.json')
}

/**
 * Load Codex OAuth config from file
 */
function loadCodexConfig() {
  try {
    const configPath = getConfigPath()
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Failed to load Codex OAuth config:', error)
  }
  return {}
}

/**
 * Save Codex OAuth config to file
 */
function saveCodexConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save Codex OAuth config:', error)
  }
}

/**
 * Generate PKCE challenge and verifier for secure OAuth flow
 * Uses S256 method as required by OpenAI
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

  return { challenge, verifier }
}

/**
 * Generate a random state value for OAuth flow
 */
function createState() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Generate the Codex OAuth authorization URL
 */
function getAuthorizationUrl(pkce, state) {
  const url = new URL(AUTHORIZE_URL)

  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('code_challenge', pkce.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  // Codex-specific parameters
  url.searchParams.set('id_token_add_organizations', 'true')
  url.searchParams.set('codex_cli_simplified_flow', 'true')
  url.searchParams.set('originator', 'codex_cli_rs')

  return url.toString()
}

/**
 * Exchange authorization code for access and refresh tokens
 * Note: Codex uses application/x-www-form-urlencoded, not JSON
 */
async function exchangeCodeForTokens(code, verifier) {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code: code,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to exchange code for tokens:', response.status, errorText)
      return null
    }

    const json = await response.json()

    if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
      console.error('Token response missing required fields:', json)
      return null
    }

    return {
      type: 'oauth',
      access: json.access_token,
      refresh: json.refresh_token,
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
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
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

    if (!json.access_token || !json.refresh_token || typeof json.expires_in !== 'number') {
      console.error('Token refresh response missing fields')
      return null
    }

    return {
      type: 'oauth',
      access: json.access_token,
      refresh: json.refresh_token,
      expires: Date.now() + json.expires_in * 1000
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return null
  }
}

/**
 * Decode a JWT token to extract payload
 */
function decodeJWT(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = Buffer.from(payload, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Extract ChatGPT account ID from JWT token
 */
function extractAccountId(token) {
  const payload = decodeJWT(token)
  if (!payload) return null

  // Look for account ID in the OpenAI-specific claim
  const authClaim = payload['https://api.openai.com/auth']
  if (authClaim && authClaim.user_id) {
    return authClaim.user_id
  }

  return null
}

/**
 * Save Codex OAuth tokens to config
 */
function saveCodexTokens(tokens) {
  const config = loadCodexConfig()
  config.oauthTokens = tokens
  saveCodexConfig(config)
}

/**
 * Get Codex OAuth tokens from config
 */
function getCodexTokens() {
  const config = loadCodexConfig()
  return config.oauthTokens || null
}

/**
 * Remove Codex OAuth tokens from config
 */
function clearCodexTokens() {
  const config = loadCodexConfig()
  delete config.oauthTokens
  saveCodexConfig(config)
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
 */
async function getValidAccessToken() {
  const tokens = getCodexTokens()
  if (!tokens) {
    return null
  }

  if (isTokenExpired(tokens)) {
    const newTokens = await refreshAccessToken(tokens.refresh)
    if (!newTokens) {
      return null
    }
    saveCodexTokens(newTokens)
    return newTokens.access
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
 * Get the current state
 */
function getState() {
  return currentState
}

/**
 * Set the current state
 */
function setState(state) {
  currentState = state
}

/**
 * Clear the current state
 */
function clearState() {
  currentState = null
}

/**
 * Start local HTTP server to capture OAuth callback
 * Returns a promise that resolves with the authorization code
 */
function startCallbackServer(expectedState) {
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

      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        // Validate state
        if (state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>OAuth Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">State Mismatch</h1>
                <p>OAuth state validation failed. Please try again.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)
          setTimeout(() => {
            if (callbackServer) {
              callbackServer.close()
              callbackServer = null
            }
          }, 1000)
          reject(new Error('State mismatch'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })

        if (error) {
          res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>OAuth Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Authentication Failed</h1>
                <p>${errorDescription || error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `)

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
              <head><title>Codex OAuth Success</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center; background: #1a1a2e; color: #fff;">
                <h1 style="color: #4ade80;">Authentication Successful</h1>
                <p>You can close this window and return to the application.</p>
                <script>window.close()</script>
              </body>
            </html>
          `)

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
              <head><title>OAuth Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Authentication Failed</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
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
      console.error('[Codex OAuth] Callback server error:', err)
      reject(err)
    })

    callbackServer.listen(REDIRECT_PORT, '127.0.0.1', () => {
      // Server started successfully
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
  return REDIRECT_URI
}

/**
 * Get the Codex API base URL
 */
function getCodexBaseUrl() {
  return CODEX_BASE_URL
}

module.exports = {
  generatePKCEChallenge,
  createState,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  decodeJWT,
  extractAccountId,
  saveCodexTokens,
  getCodexTokens,
  clearCodexTokens,
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
  getCodexBaseUrl,
  CLIENT_ID,
  CODEX_BASE_URL,
}
