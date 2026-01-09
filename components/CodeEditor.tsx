import { useRef, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'

interface CodeEditorProps {
  filePath?: string
  content?: string
  language?: string
  onChange?: (value: string | undefined) => void
  onSave?: (value: string) => void
  isDarkMode?: boolean
  readOnly?: boolean
  initialLine?: number
}

export const CodeEditor = ({
  filePath,
  content = '',
  language,
  onChange,
  onSave,
  isDarkMode = false,
  readOnly = false,
  initialLine
}: CodeEditorProps) => {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  // Detect language from file extension
  const detectedLanguage = language || detectLanguage(filePath)

  // Jump to line when initialLine changes
  useEffect(() => {
    if (initialLine && editorRef.current) {
      // Reveal the line in the center of the editor and highlight it
      editorRef.current.revealLineInCenter(initialLine)
      editorRef.current.setPosition({ lineNumber: initialLine, column: 1 })
      editorRef.current.focus()
    }
  }, [initialLine])

  useEffect(() => {
    // Set up save shortcut (Cmd+S / Ctrl+S)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (onSave && editorRef.current) {
          const value = editorRef.current.getValue()
          onSave(value)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave])

  const handleEditorDidMount = (editor: MonacoEditor.IStandaloneCodeEditor) => {
    editorRef.current = editor
  }

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage={detectedLanguage}
        language={detectedLanguage}
        value={content}
        onChange={onChange}
        theme={isDarkMode ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: true },
          fontSize: 13,
          fontFamily: "'SF Mono', Monaco, Menlo, 'Courier New', monospace",
          lineNumbers: 'on',
          rulers: [],
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          readOnly,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  )
}

function detectLanguage(filePath?: string): string {
  if (!filePath) return 'plaintext'

  const ext = filePath.split('.').pop()?.toLowerCase()

  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'md': 'markdown',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'sql': 'sql',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'dockerfile': 'dockerfile',
  }

  return languageMap[ext || ''] || 'plaintext'
}

export default CodeEditor
