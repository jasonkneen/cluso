/**
 * OAuth implementation for Anthropic API keys and Claude Code
 * Implements PKCE flow with token refresh and API key creation
 */

const crypto = require('crypto')
const http = require('http')
const { app } = require('electron')
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

/**
 * Get the config file path
 */
function getConfigPath() {
  return path.join(app.getPath('userData'), 'oauth-config.json')
}

/**
 * Load OAuth config from file
 */
function loadOAuthConfig() {
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
 * Save OAuth config to file
 */
function saveOAuthConfig(config) {
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2))
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
 * Save OAuth tokens to config
 */
function saveOAuthTokens(tokens) {
  const config = loadOAuthConfig()
  config.oauthTokens = tokens
  saveOAuthConfig(config)
}

/**
 * Get OAuth tokens from config
 */
function getOAuthTokens() {
  const config = loadOAuthConfig()
  return config.oauthTokens || null
}

/**
 * Remove OAuth tokens from config
 */
function clearOAuthTokens() {
  const config = loadOAuthConfig()
  delete config.oauthTokens
  saveOAuthConfig(config)
}

/**
 * Save Claude Code API key to config
 */
function saveClaudeCodeApiKey(apiKey) {
  const config = loadOAuthConfig()
  config.claudeCodeApiKey = apiKey
  saveOAuthConfig(config)
}

/**
 * Get Claude Code API key from config
 */
function getClaudeCodeApiKey() {
  const config = loadOAuthConfig()
  return config.claudeCodeApiKey || null
}

/**
 * Clear Claude Code API key from config
 */
function clearClaudeCodeApiKey() {
  const config = loadOAuthConfig()
  delete config.claudeCodeApiKey
  saveOAuthConfig(config)
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
  const tokens = getOAuthTokens()
  if (!tokens) {
    return null
  }

  if (isTokenExpired(tokens)) {
    console.log('Access token expired, refreshing...')
    const newTokens = await refreshAccessToken(tokens.refresh)
    if (!newTokens) {
      console.error('Failed to refresh token')
      return null
    }
    saveOAuthTokens(newTokens)
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
              <head><title>OAuth Error</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #dc2626;">Authentication Failed</h1>
                <p>${errorDescription || error}</p>
                <p>You can close this window.</p>
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
              <head><title>OAuth Success</title></head>
              <body style="font-family: system-ui; padding: 40px; text-align: center;">
                <h1 style="color: #16a34a;">✓ Authentication Successful</h1>
                <p>You can close this window and return to the application.</p>
                <script>window.close()</script>
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
}
