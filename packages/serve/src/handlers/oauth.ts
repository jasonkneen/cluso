// @ts-nocheck
/**
 * OAuth authentication handlers for Cluso server
 * Manages Anthropic Claude OAuth flow with PKCE and token refresh
 */

import { homedir } from 'os'
import { promises as fs } from 'fs'
import { join } from 'path'
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto'

import type { Result } from '../types/api.js'

// ==========================================
// OAuth Configuration
// ==========================================

const OAUTH_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const OAUTH_TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token'
const OAUTH_MAX_AUTH_URL = 'https://claude.ai/oauth/authorize'
const OAUTH_CONSOLE_AUTH_URL = 'https://console.anthropic.com/oauth/authorize'
const OAUTH_SCOPES = ['org:create_api_key', 'user:profile', 'user:inference']
const OAUTH_REDIRECT_URI = 'http://localhost:54545/callback'

// Encryption key for token storage (derived from machine ID to be consistent)
function getEncryptionKey(): Buffer {
  // Use environment machine ID or fixed fallback for consistency
  const machineId = process.env.HOSTNAME || process.env.COMPUTERNAME || 'default-machine'
  return createHash('sha256').update(machineId + 'cluso-oauth').digest()
}

/**
 * Get OAuth config directory
 */
function getOAuthDir(): string {
  return join(process.env.HOME || homedir(), '.cluso')
}

/**
 * Get OAuth config file path
 */
function getOAuthConfigPath(): string {
  return join(getOAuthDir(), 'oauth-config.json')
}

/**
 * OAuth config structure
 */
interface OAuthConfig {
  accessToken: string
  refreshToken: string
  expiresAt: number
  mode: 'max' | 'console'
}

/**
 * Encrypt sensitive data for storage
 */
function encryptData(data: string): string {
  const iv = randomBytes(16)
  const key = getEncryptionKey()
  const cipher = createCipheriv('aes-256-cbc', key, iv)

  let encrypted = cipher.update(data, 'utf-8', 'hex')
  encrypted += cipher.final('hex')

  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypt sensitive data from storage
 */
function decryptData(encryptedData: string): string {
  const parts = encryptedData.split(':')
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  const key = getEncryptionKey()
  const decipher = createDecipheriv('aes-256-cbc', key, iv)

  let decrypted = decipher.update(encrypted, 'hex', 'utf-8')
  decrypted += decipher.final('utf-8')

  return decrypted
}

/**
 * Read OAuth config from disk
 */
async function readOAuthConfig(): Promise<OAuthConfig | null> {
  try {
    const configPath = getOAuthConfigPath()
    const content = await fs.readFile(configPath, 'utf-8')
    const data = JSON.parse(content)

    return {
      accessToken: decryptData(data.accessToken),
      refreshToken: decryptData(data.refreshToken),
      expiresAt: data.expiresAt,
      mode: data.mode,
    }
  } catch {
    return null
  }
}

/**
 * Write OAuth config to disk (encrypted)
 */
async function writeOAuthConfig(config: OAuthConfig): Promise<void> {
  const configDir = getOAuthDir()

  // Create directory if needed
  try {
    await fs.mkdir(configDir, { recursive: true })
  } catch {
    // Directory may already exist
  }

  const encrypted = {
    accessToken: encryptData(config.accessToken),
    refreshToken: encryptData(config.refreshToken),
    expiresAt: config.expiresAt,
    mode: config.mode,
  }

  await fs.writeFile(getOAuthConfigPath(), JSON.stringify(encrypted, null, 2), 'utf-8')
}

// ==========================================
// PKCE Helpers
// ==========================================

/**
 * Generate PKCE verifier and challenge
 * Returns { verifier, challenge }
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  // Generate 128-character random string (base64url)
  const verifier = randomBytes(96).toString('base64url')

  // Create challenge as SHA256 hash of verifier (base64url)
  const challenge = createHash('sha256').update(verifier).digest('base64url')

  return { verifier, challenge }
}

/**
 * Generate CSRF state parameter
 */
function generateState(): string {
  return randomBytes(32).toString('hex')
}

// ==========================================
// OAuth Flow Functions
// ==========================================

/**
 * Start OAuth login flow (PKCE)
 * Returns authorization URL and required values for completion
 *
 * @param mode - 'max' for Claude.ai or 'console' for console.anthropic.com
 * @returns { authUrl, verifier, state }
 */
export function startLogin(mode: 'max' | 'console'): Result<{
  authUrl: string
  verifier: string
  state: string
}> {
  try {
    if (mode !== 'max' && mode !== 'console') {
      return { success: false, error: 'Invalid mode: must be "max" or "console"' }
    }

    const { verifier, challenge } = generatePKCE()
    const state = generateState()

    const authUrl = mode === 'max' ? OAUTH_MAX_AUTH_URL : OAUTH_CONSOLE_AUTH_URL

    const params = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      response_type: 'code',
      redirect_uri: OAUTH_REDIRECT_URI,
      scope: OAUTH_SCOPES.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    })

    return {
      success: true,
      data: {
        authUrl: `${authUrl}?${params.toString()}`,
        verifier,
        state,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to start login: ${message}` }
  }
}

/**
 * Complete OAuth login flow by exchanging authorization code for tokens
 *
 * @param code - Authorization code from callback
 * @param verifier - PKCE verifier from startLogin
 * @param state - State parameter from startLogin
 * @param stateParam - State parameter from callback (for CSRF verification)
 * @returns { accessToken, refreshToken, expiresIn }
 */
export async function completeLogin(
  code: string,
  verifier: string,
  state: string,
  stateParam: string
): Promise<Result<{ accessToken: string; expiresIn: number }>> {
  try {
    // Verify state matches (CSRF protection)
    if (state !== stateParam) {
      return { success: false, error: 'State mismatch - possible CSRF attack' }
    }

    if (!code || !verifier) {
      return { success: false, error: 'Code and verifier are required' }
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: OAUTH_CLIENT_ID,
        code,
        redirect_uri: OAUTH_REDIRECT_URI,
        code_verifier: verifier,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      return {
        success: false,
        error: `Token exchange failed: ${errorData.error || tokenResponse.statusText}`,
      }
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    if (!tokenData.access_token) {
      return { success: false, error: 'No access token in response' }
    }

    // Determine mode from URL (we'll default to console since that's the token endpoint)
    const mode = 'console'

    // Store tokens
    const expiresAt = Date.now() + tokenData.expires_in * 1000

    await writeOAuthConfig({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      expiresAt,
      mode,
    })

    return {
      success: true,
      data: {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to complete login: ${message}` }
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<Result<{ accessToken: string; expiresIn: number }>> {
  try {
    const config = await readOAuthConfig()

    if (!config || !config.refreshToken) {
      return { success: false, error: 'No refresh token available' }
    }

    const tokenResponse = await fetch(OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: OAUTH_CLIENT_ID,
        refresh_token: config.refreshToken,
      }).toString(),
    })

    if (!tokenResponse.ok) {
      return { success: false, error: 'Token refresh failed' }
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
    }

    const expiresAt = Date.now() + tokenData.expires_in * 1000

    await writeOAuthConfig({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || config.refreshToken,
      expiresAt: expiresAt,
      mode: config.mode,
    })

    return {
      success: true,
      data: {
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to refresh token: ${message}` }
  }
}

/**
 * Get valid access token (auto-refresh if needed)
 * Returns current access token, refreshing if it's about to expire
 *
 * @returns { accessToken, expiresIn, mode }
 */
export async function getAccessToken(): Promise<
  Result<{
    accessToken: string
    expiresIn: number
    mode: 'max' | 'console'
  }>
> {
  try {
    const config = await readOAuthConfig()

    if (!config) {
      return { success: false, error: 'Not logged in' }
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const now = Date.now()
    const timeUntilExpiry = config.expiresAt - now
    const refreshThreshold = 5 * 60 * 1000 // 5 minutes

    if (timeUntilExpiry < refreshThreshold) {
      // Token is expired or about to expire, refresh it
      const refreshResult = await refreshAccessToken()

      if (!refreshResult.success) {
        return { success: false, error: refreshResult.error }
      }

      const newConfig = await readOAuthConfig()
      if (!newConfig) {
        return { success: false, error: 'Failed to read refreshed config' }
      }

      return {
        success: true,
        data: {
          accessToken: newConfig.accessToken,
          expiresIn: Math.floor((newConfig.expiresAt - now) / 1000),
          mode: newConfig.mode,
        },
      }
    }

    return {
      success: true,
      data: {
        accessToken: config.accessToken,
        expiresIn: Math.floor(timeUntilExpiry / 1000),
        mode: config.mode,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to get access token: ${message}` }
  }
}

/**
 * Get OAuth status and metadata
 *
 * @returns OAuth status including login state, mode, and expiry
 */
export async function getStatus(): Promise<
  Result<{
    isLoggedIn: boolean
    mode: 'max' | 'console' | null
    expiresAt: string | null
    expiresIn: number | null
  }>
> {
  try {
    const config = await readOAuthConfig()

    if (!config) {
      return {
        success: true,
        data: {
          isLoggedIn: false,
          mode: null,
          expiresAt: null,
          expiresIn: null,
        },
      }
    }

    const now = Date.now()
    const expiresIn = Math.max(0, Math.floor((config.expiresAt - now) / 1000))
    const isExpired = expiresIn <= 0

    return {
      success: true,
      data: {
        isLoggedIn: !isExpired,
        mode: config.mode,
        expiresAt: new Date(config.expiresAt).toISOString(),
        expiresIn: isExpired ? 0 : expiresIn,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to get status: ${message}` }
  }
}

/**
 * Logout and clear stored tokens
 *
 * @returns Success message
 */
export async function logout(): Promise<Result<string>> {
  try {
    const configPath = getOAuthConfigPath()

    try {
      await fs.unlink(configPath)
    } catch {
      // File may not exist
    }

    return { success: true, data: 'Logged out successfully' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to logout: ${message}` }
  }
}
