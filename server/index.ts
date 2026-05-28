import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PORT || 8787)
const app = express()
const clientOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

if (clientOrigins.length > 0) {
  app.use(cors({ origin: clientOrigins }))
}

app.use(express.json({ limit: '64kb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
  })
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(__dirname, '../dist')

if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^\/(?!api).*/, (_request, response) => {
    response.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Movement Break server listening on http://localhost:${port}`)
})

process.on('SIGINT', () => {
  process.exit(0)
})
