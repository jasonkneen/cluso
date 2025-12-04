/**
 * Language Extension Mappings
 * Maps file extensions to LSP language identifiers
 */

import path from 'path'

export const LANGUAGE_EXTENSIONS: Record<string, string> = {
  // TypeScript/JavaScript
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.mts': 'typescript',
  '.cts': 'typescript',

  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.astro': 'astro',

  // Data formats
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',

  // Python
  '.py': 'python',
  '.pyi': 'python',
  '.pyx': 'python',

  // Go
  '.go': 'go',
  '.mod': 'go.mod',

  // Rust
  '.rs': 'rust',

  // Ruby
  '.rb': 'ruby',
  '.erb': 'erb',
  '.rake': 'ruby',
  '.gemspec': 'ruby',

  // PHP
  '.php': 'php',

  // Java/Kotlin
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',

  // C/C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'hpp',

  // C#
  '.cs': 'csharp',

  // Swift
  '.swift': 'swift',

  // Shell
  '.sh': 'shellscript',
  '.bash': 'shellscript',
  '.zsh': 'shellscript',
  '.fish': 'fish',

  // Elixir/Erlang
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',

  // Lua
  '.lua': 'lua',

  // Zig
  '.zig': 'zig',

  // Dart
  '.dart': 'dart',

  // Scala
  '.scala': 'scala',
  '.sc': 'scala',

  // Haskell
  '.hs': 'haskell',

  // OCaml
  '.ml': 'ocaml',
  '.mli': 'ocaml',

  // SQL
  '.sql': 'sql',

  // Markdown
  '.md': 'markdown',
  '.mdx': 'mdx',

  // Docker
  Dockerfile: 'dockerfile',
  '.dockerfile': 'dockerfile',

  // GraphQL
  '.graphql': 'graphql',
  '.gql': 'graphql',

  // Prisma
  '.prisma': 'prisma',

  // Terraform
  '.tf': 'terraform',
  '.tfvars': 'terraform',
}

/**
 * Get the LSP language ID for a file path
 */
export function getLanguageId(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const basename = path.basename(filePath)

  // Check basename first (for files like Dockerfile)
  if (LANGUAGE_EXTENSIONS[basename]) {
    return LANGUAGE_EXTENSIONS[basename]
  }

  return LANGUAGE_EXTENSIONS[ext] || 'plaintext'
}

/**
 * Get the file extension for a language ID
 */
export function getExtensionForLanguage(languageId: string): string | null {
  for (const [ext, lang] of Object.entries(LANGUAGE_EXTENSIONS)) {
    if (lang === languageId) return ext
  }
  return null
}
