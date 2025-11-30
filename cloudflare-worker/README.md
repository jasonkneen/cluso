# Codex Proxy Worker

A Cloudflare Worker that proxies requests to ChatGPT's backend API, bypassing Cloudflare's bot protection.

## Why is this needed?

The `chatgpt.com/backend-api` endpoint is protected by Cloudflare's bot detection. Direct requests from Node.js/Electron are blocked with a 403 challenge. Running the proxy on Cloudflare's infrastructure bypasses this protection.

## Setup

### Prerequisites

1. [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

```bash
npm install -g wrangler
wrangler login
```

### Deploy

```bash
cd cloudflare-worker
wrangler deploy
```

This will deploy to: `https://codex-proxy.<your-subdomain>.workers.dev`

### (Optional) Set a proxy API key

To require authentication to your proxy:

```bash
wrangler secret put PROXY_API_KEY
# Enter a random string when prompted
```

Then set in your app's `.env`:
```
CODEX_PROXY_API_KEY=your-random-string
```

## Configuration

In your app's `.env` file:

```env
# Required: URL of your deployed worker
CODEX_PROXY_URL=https://codex-proxy.your-subdomain.workers.dev

# Optional: API key if you set PROXY_API_KEY secret
CODEX_PROXY_API_KEY=your-random-string
```

## How it works

1. App authenticates user with Codex OAuth (gets token)
2. App sends request to proxy with token in `X-Codex-Token` header
3. Proxy forwards request to `chatgpt.com/backend-api` with proper auth
4. Response is returned to app

```
[Electron App] --X-Codex-Token--> [CF Worker] --Authorization--> [ChatGPT API]
```

## API

The worker maps OpenAI-compatible paths:

| Request Path | Proxied To |
|-------------|------------|
| `/v1/responses` | `/codex/responses` |
| `/v1/chat/completions` | `/codex/responses` |
| `/responses` | `/codex/responses` |

## Security Notes

- The proxy doesn't store your OAuth token
- Set PROXY_API_KEY to prevent unauthorized use of your worker
- The free Cloudflare tier has generous limits (100,000 requests/day)
