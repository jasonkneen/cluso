/**
 * Codex Proxy Worker for Cloudflare
 *
 * This worker proxies requests to chatgpt.com/backend-api
 * It runs on Cloudflare's infrastructure, bypassing their bot protection.
 *
 * Deploy with: wrangler deploy
 *
 * Set these secrets:
 *   wrangler secret put PROXY_API_KEY
 */

const CHATGPT_BASE_URL = 'https://chatgpt.com/backend-api';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Codex-Token, OpenAI-Beta, originator, session_id, chatgpt-account-id',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Validate proxy API key (optional - set PROXY_API_KEY secret to enable)
    if (env.PROXY_API_KEY) {
      const authHeader = request.headers.get('Authorization');
      const proxyKey = authHeader?.replace('Bearer ', '');
      if (proxyKey !== env.PROXY_API_KEY) {
        return new Response(JSON.stringify({ error: 'Invalid proxy API key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Get the actual Codex OAuth token from custom header
    const codexToken = request.headers.get('X-Codex-Token');
    if (!codexToken) {
      return new Response(JSON.stringify({ error: 'Missing X-Codex-Token header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse the URL path
    const url = new URL(request.url);
    let targetPath = url.pathname;

    // Map OpenAI-compatible paths to Codex paths
    if (targetPath === '/v1/chat/completions' || targetPath === '/chat/completions') {
      targetPath = '/codex/responses';
    } else if (targetPath === '/v1/responses' || targetPath === '/responses') {
      targetPath = '/codex/responses';
    }

    const targetUrl = `${CHATGPT_BASE_URL}${targetPath}`;

    // Build headers for ChatGPT
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${codexToken}`);
    headers.set('OpenAI-Beta', request.headers.get('OpenAI-Beta') || 'responses=experimental');
    headers.set('originator', request.headers.get('originator') || 'codex_cli_rs');
    headers.set('session_id', request.headers.get('session_id') || crypto.randomUUID());

    // Pass through account ID if present
    const accountId = request.headers.get('chatgpt-account-id');
    if (accountId) {
      headers.set('chatgpt-account-id', accountId);
    }

    // Forward the request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    // Return response with CORS headers
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
