// Tiny mock server for E2E:
//  - GET /sample.html         → static fixture
//  - POST /__mock/next        → set { reply | chunks } for the next stream
//  - POST /v1/chat/completions → stream SSE using current mock state
// Started by Playwright via webServer.

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const PORT = Number(process.env.MOCK_PORT ?? 4242)

let nextReply = 'Mocked **markdown** response.'
let nextChunks = null

function splitIntoChunks(text, parts = 4) {
  const size = Math.max(1, Math.ceil(text.length / parts))
  const out = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const bufs = []
    req.on('data', (b) => bufs.push(b))
    req.on('end', () => resolve(Buffer.concat(bufs).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  // Permissive CORS so the extension SW can call us cross-origin.
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', '*')
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

  if (req.method === 'POST' && url.pathname === '/__mock/next') {
    try {
      const raw = await readBody(req)
      const body = raw ? JSON.parse(raw) : {}
      if (typeof body.reply === 'string') nextReply = body.reply
      if (Array.isArray(body.chunks)) nextChunks = body.chunks
      else if (typeof body.reply === 'string') nextChunks = null
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
    } catch (err) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: String(err) }))
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    const chunks = nextChunks ?? splitIntoChunks(nextReply, 4)
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    for (const chunk of chunks) {
      const payload = JSON.stringify({ choices: [{ delta: { content: chunk } }] })
      res.write(`data: ${payload}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
    return
  }

  if (req.method === 'GET' && url.pathname === '/v1/models') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }))
    return
  }

  // Static fixtures fallback.
  if (req.method === 'GET') {
    const rel = url.pathname === '/' ? '/sample.html' : url.pathname
    const file = path.join(FIXTURES_DIR, rel)
    if (file.startsWith(FIXTURES_DIR) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': contentType(file) })
      fs.createReadStream(file).pipe(res)
      return
    }
  }

  res.writeHead(404)
  res.end('not found')
})

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (file.endsWith('.json')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

server.listen(PORT, () => {
  // biome-ignore lint/suspicious/noConsole: mock server boot log is intentional for test debugging
  console.log(`[mock-server] listening on http://127.0.0.1:${PORT}`)
})
