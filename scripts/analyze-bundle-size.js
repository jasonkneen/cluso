#!/usr/bin/env node

/**
 * Analyze what's taking up space in the Electron build
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function getDirectorySize(dir) {
  let size = 0

  try {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)

      if (stats.isDirectory()) {
        size += getDirectorySize(filePath)
      } else {
        size += stats.size
      }
    }
  } catch (err) {
    // Ignore permission errors
  }

  return size
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function analyzeNodeModules() {
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules')

  if (!fs.existsSync(nodeModulesPath)) {
    console.log('node_modules not found')
    return
  }

  const packages = fs.readdirSync(nodeModulesPath)
    .filter(name => !name.startsWith('.'))
    .map(name => {
      const packagePath = path.join(nodeModulesPath, name)

      if (name.startsWith('@')) {
        // Scoped package
        const scoped = fs.readdirSync(packagePath)
          .map(subName => {
            const subPath = path.join(packagePath, subName)
            return {
              name: `${name}/${subName}`,
              size: getDirectorySize(subPath)
            }
          })
        return scoped
      }

      return {
        name,
        size: getDirectorySize(packagePath)
      }
    })
    .flat()
    .filter(p => p && p.size > 0)
    .sort((a, b) => b.size - a.size)

  console.log('\n🔍 Top 20 Largest Dependencies:\n')

  packages.slice(0, 20).forEach((pkg, i) => {
    console.log(`${i + 1}. ${pkg.name.padEnd(50)} ${formatBytes(pkg.size)}`)
  })

  const totalSize = packages.reduce((sum, pkg) => sum + pkg.size, 0)
  console.log(`\n📦 Total node_modules size: ${formatBytes(totalSize)}`)
}

function analyzeDist() {
  const distPath = path.join(__dirname, '..', 'dist')

  if (!fs.existsSync(distPath)) {
    console.log('\ndist not found - run npm run build first')
    return
  }

  const distSize = getDirectorySize(distPath)
  console.log(`\n📁 dist/ size: ${formatBytes(distSize)}`)

  // Break down by type
  const assetTypes = {}

  function walkDir(dir) {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)

      if (stats.isDirectory()) {
        walkDir(filePath)
      } else {
        const ext = path.extname(file) || 'no-ext'
        assetTypes[ext] = (assetTypes[ext] || 0) + stats.size
      }
    }
  }

  walkDir(distPath)

  console.log('\n📊 Asset breakdown by type:')
  Object.entries(assetTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([ext, size]) => {
      console.log(`  ${ext.padEnd(10)} ${formatBytes(size)}`)
    })
}

function analyzeElectronDir() {
  const electronPath = path.join(__dirname, '..', 'electron')

  if (!fs.existsSync(electronPath)) {
    console.log('\nelectron/ not found')
    return
  }

  const electronSize = getDirectorySize(electronPath)
  console.log(`\n⚡ electron/ size: ${formatBytes(electronSize)}`)
}

function suggestOptimizations() {
  console.log('\n💡 Optimization Suggestions:\n')

  const suggestions = [
    '1. Run `npm prune --production` before building',
    '2. Use `electron-builder` with `compression: "maximum"`',
    '3. Enable ASAR packaging for better compression',
    '4. Remove unused language files and docs from dependencies',
    '5. Consider lazy-loading heavy dependencies',
    '6. Use tree-shaking for ES modules where possible',
    '7. Compress assets (images, fonts) during build',
    '8. Review and remove unused Shiki themes/languages'
  ]

  suggestions.forEach(s => console.log(s))
}

console.log('📦 Cluso Bundle Size Analysis\n')
console.log('='.repeat(60))

analyzeNodeModules()
analyzeDist()
analyzeElectronDir()
suggestOptimizations()

console.log('\n' + '='.repeat(60))
