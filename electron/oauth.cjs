/**
 * OAuth implementation for Anthropic API keys and Claude Code
 * Implements PKCE flow with token refresh and API key creation
 */

const crypto = require('crypto')
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

// OAuth Constants
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const AUTHORIZATION_ENDPOINT_MAX = 'https://claude.ai/oauth/authorize'
const AUTHORIZATION_ENDPOINT_CONSOLE = 'https://console.anthropic.com/oauth/authorize'
const TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token'
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback'
const CREATE_API_KEY_ENDPOINT = 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key'
const SCOPES = 'org:create_api_key user:profile user:inference'

// Store PKCE verifier temporarily during OAuth flow
let currentPKCEVerifier = null

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

  return { challenge, verifier }
}

/**
 * Generate the OAuth authorization URL
 * @param {'max' | 'console'} mode - 'max' for Claude Pro/Max, 'console' for Console API
 * @param {Object} pkce - The PKCE challenge object
 */
function getAuthorizationUrl(mode, pkce) {
  const baseUrl = mode === 'max' ? AUTHORIZATION_ENDPOINT_MAX : AUTHORIZATION_ENDPOINT_CONSOLE
  const url = new URL(baseUrl)

  url.searchParams.set('code', 'true')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', REDIRECT_URI)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('code_challenge', pkce.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', pkce.verifier)

  return url.toString()
}

/**
 * Exchange authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(code, verifier) {
  try {
    // The code might contain the state appended with #
    const splits = code.split('#')
    const authCode = splits[0]
    const state = splits[1]

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: authCode,
        state: state,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier
      })
    })

    if (!response.ok) {
      console.error('Failed to exchange code for tokens:', response.statusText)
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
      console.error('Failed to create API key:', response.statusText)
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

module.exports = {
  generatePKCEChallenge,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  createApiKey,
  saveOAuthTokens,
  getOAuthTokens,
  clearOAuthTokens,
  isTokenExpired,
  getValidAccessToken,
  getPKCEVerifier,
  setPKCEVerifier,
  clearPKCEVerifier,
}
