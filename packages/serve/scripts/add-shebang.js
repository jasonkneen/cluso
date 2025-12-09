import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const cliPath = join(__dirname, '..', 'dist', 'cli.js')

const shebang = '#!/usr/bin/env node\n'
const content = readFileSync(cliPath, 'utf-8')

if (!content.startsWith('#!')) {
  writeFileSync(cliPath, shebang + content)
  console.log('Added shebang to cli.js')
} else {
  console.log('Shebang already present')
}
