/**
 * Agent Todos Aggregator
 *
 * Discovers and aggregates todos from various AI coding agents:
 * - Claude Code: ~/.claude/projects/[encoded-path]/ (session files)
 * - Cline/Kilo Code: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/
 * - Roo Code: .roo/ directory + memory-bank/ folder
 * - OpenAI Codex: ~/.codex/ + AGENTS.md
 * - Aider: .aider.todo.md or similar patterns
 * - Windsurf/Cascade: .windsurf/ directory
 */

const path = require('path')
const fs = require('fs').promises
const os = require('os')

// Reference to main window for IPC
let mainWindow = null

/**
 * Set the main window reference for IPC
 */
function setMainWindow(win) {
  mainWindow = win
}

/**
 * Send event to renderer
 */
function sendEvent(type, data) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('agent-todos:event', { type, ...data })
}

/**
 * Agent definitions with their storage locations and parsing methods
 */
const AGENTS = {
  'claude-code': {
    name: 'Claude Code',
    icon: '🤖',
    color: '#D97706', // amber
    getLocations: (projectPath) => {
      const homeDir = os.homedir()
      // Claude encodes project paths - try to find matching sessions
      return [
        path.join(homeDir, '.claude', 'projects'),
      ]
    },
    parseFile: parseClaude,
  },
  'cline': {
    name: 'Cline',
    icon: '🔷',
    color: '#3B82F6', // blue
    getLocations: () => {
      const homeDir = os.homedir()
      const platform = process.platform
      if (platform === 'darwin') {
        return [path.join(homeDir, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev')]
      } else if (platform === 'win32') {
        return [path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev')]
      } else {
        return [path.join(homeDir, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev')]
      }
    },
    parseFile: parseCline,
  },
  'roo-code': {
    name: 'Roo Code',
    icon: '🦘',
    color: '#10B981', // emerald
    getLocations: (projectPath) => [
      path.join(projectPath, '.roo'),
      path.join(projectPath, 'memory-bank'),
    ],
    parseFile: parseRoo,
  },
  'codex': {
    name: 'Codex',
    icon: '⚡',
    color: '#8B5CF6', // violet
    getLocations: (projectPath) => {
      const homeDir = os.homedir()
      return [
        path.join(homeDir, '.codex'),
        path.join(projectPath, 'AGENTS.md'),
      ]
    },
    parseFile: parseCodex,
  },
  'aider': {
    name: 'Aider',
    icon: '🎯',
    color: '#EF4444', // red
    getLocations: (projectPath) => [
      path.join(projectPath, '.aider.todo.md'),
      path.join(projectPath, '.aider'),
      path.join(projectPath, 'memory-bank'),
    ],
    parseFile: parseAider,
  },
  'windsurf': {
    name: 'Windsurf',
    icon: '🏄',
    color: '#06B6D4', // cyan
    getLocations: (projectPath) => {
      const homeDir = os.homedir()
      return [
        path.join(projectPath, '.windsurf'),
        path.join(homeDir, '.codeium'),
      ]
    },
    parseFile: parseWindsurf,
  },
}

/**
 * Parse Claude Code session files for todos
 */
async function parseClaude(filePath, projectPath) {
  const todos = []

  try {
    // Claude stores sessions in encoded paths under ~/.claude/projects/
    const stat = await fs.stat(filePath)
    if (!stat.isDirectory()) return todos

    // Look for JSONL session files
    const files = await fs.readdir(filePath)
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue

      const content = await fs.readFile(path.join(filePath, file), 'utf-8')
      const lines = content.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          // Look for TodoWrite tool calls
          if (entry.type === 'tool_use' && entry.name === 'TodoWrite') {
            const todoItems = entry.input?.todos || []
            for (const item of todoItems) {
              todos.push({
                id: `claude-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text: item.content,
                completed: item.status === 'completed',
                status: item.status,
                agent: 'claude-code',
                source: file,
                createdAt: new Date().toISOString(),
              })
            }
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return todos
}

/**
 * Parse Cline task history for todos
 */
async function parseCline(filePath, projectPath) {
  const todos = []

  try {
    const stat = await fs.stat(filePath)
    if (!stat.isDirectory()) return todos

    // Check for taskHistory.json
    const taskHistoryPath = path.join(filePath, 'state', 'taskHistory.json')
    try {
      const content = await fs.readFile(taskHistoryPath, 'utf-8')
      const history = JSON.parse(content)

      // Extract tasks from history
      if (Array.isArray(history)) {
        for (const task of history) {
          if (task.task && !task.completed) {
            todos.push({
              id: `cline-${task.id || Date.now()}`,
              text: task.task,
              completed: false,
              agent: 'cline',
              source: 'taskHistory.json',
              createdAt: task.timestamp || new Date().toISOString(),
            })
          }
        }
      }
    } catch {
      // No task history
    }

    // Also check individual task folders
    const tasksDir = path.join(filePath, 'tasks')
    try {
      const tasks = await fs.readdir(tasksDir)
      for (const taskId of tasks.slice(-10)) { // Last 10 tasks
        const metaPath = path.join(tasksDir, taskId, 'task_metadata.json')
        try {
          const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'))
          if (meta.task_description) {
            todos.push({
              id: `cline-task-${taskId}`,
              text: meta.task_description,
              completed: meta.status === 'completed',
              agent: 'cline',
              source: taskId,
              createdAt: meta.created_at || new Date().toISOString(),
            })
          }
        } catch {
          // Skip
        }
      }
    } catch {
      // No tasks directory
    }
  } catch {
    // Directory doesn't exist
  }

  return todos
}

/**
 * Parse Roo Code memory bank for todos
 */
async function parseRoo(filePath, projectPath) {
  const todos = []

  try {
    const stat = await fs.stat(filePath)

    if (stat.isDirectory()) {
      // Look for markdown files with todos
      const files = await fs.readdir(filePath)
      for (const file of files) {
        if (!file.endsWith('.md')) continue

        const content = await fs.readFile(path.join(filePath, file), 'utf-8')
        const parsedTodos = parseMarkdownTodos(content, 'roo-code', file)
        todos.push(...parsedTodos)
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return todos
}

/**
 * Parse OpenAI Codex AGENTS.md for todos
 */
async function parseCodex(filePath, projectPath) {
  const todos = []

  try {
    const stat = await fs.stat(filePath)

    if (stat.isFile() && filePath.endsWith('.md')) {
      const content = await fs.readFile(filePath, 'utf-8')
      const parsedTodos = parseMarkdownTodos(content, 'codex', path.basename(filePath))
      todos.push(...parsedTodos)
    } else if (stat.isDirectory()) {
      // Look in ~/.codex for session data
      const files = await fs.readdir(filePath)
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(filePath, file), 'utf-8')
            if (file.endsWith('.md')) {
              todos.push(...parseMarkdownTodos(content, 'codex', file))
            }
          } catch {
            // Skip
          }
        }
      }
    }
  } catch {
    // Path doesn't exist
  }

  return todos
}

/**
 * Parse Aider files for todos
 */
async function parseAider(filePath, projectPath) {
  const todos = []

  try {
    const stat = await fs.stat(filePath)

    if (stat.isFile() && filePath.endsWith('.md')) {
      const content = await fs.readFile(filePath, 'utf-8')
      todos.push(...parseMarkdownTodos(content, 'aider', path.basename(filePath)))
    } else if (stat.isDirectory()) {
      const files = await fs.readdir(filePath)
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(filePath, file), 'utf-8')
          todos.push(...parseMarkdownTodos(content, 'aider', file))
        }
      }
    }
  } catch {
    // Path doesn't exist
  }

  return todos
}

/**
 * Parse Windsurf files for todos
 */
async function parseWindsurf(filePath, projectPath) {
  const todos = []

  try {
    const stat = await fs.stat(filePath)

    if (stat.isDirectory()) {
      // Look for memories or rules files
      const files = await fs.readdir(filePath)
      for (const file of files) {
        if (file.endsWith('.md') || file === 'memories.json' || file === 'rules.json') {
          try {
            const content = await fs.readFile(path.join(filePath, file), 'utf-8')
            if (file.endsWith('.json')) {
              const data = JSON.parse(content)
              // Look for task-like items in memories
              if (Array.isArray(data)) {
                for (const item of data) {
                  if (item.type === 'task' || item.text?.includes('TODO')) {
                    todos.push({
                      id: `windsurf-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      text: item.text || item.content,
                      completed: false,
                      agent: 'windsurf',
                      source: file,
                      createdAt: item.timestamp || new Date().toISOString(),
                    })
                  }
                }
              }
            } else {
              todos.push(...parseMarkdownTodos(content, 'windsurf', file))
            }
          } catch {
            // Skip
          }
        }
      }
    }
  } catch {
    // Path doesn't exist
  }

  return todos
}

/**
 * Parse markdown content for todo items
 * Supports: - [ ] item, - [x] item, * [ ] item, TODO: item, FIXME: item
 */
function parseMarkdownTodos(content, agent, source) {
  const todos = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Checkbox style: - [ ] or - [x] or * [ ] or * [x]
    const checkboxMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)
    if (checkboxMatch) {
      const completed = checkboxMatch[1].toLowerCase() === 'x'
      todos.push({
        id: `${agent}-${source}-${i}`,
        text: checkboxMatch[2].trim(),
        completed,
        agent,
        source,
        line: i + 1,
        createdAt: new Date().toISOString(),
      })
      continue
    }

    // TODO: or FIXME: style
    const todoMatch = line.match(/^(TODO|FIXME|XXX|HACK|BUG):\s*(.+)$/i)
    if (todoMatch) {
      todos.push({
        id: `${agent}-${source}-${i}`,
        text: `[${todoMatch[1].toUpperCase()}] ${todoMatch[2].trim()}`,
        completed: false,
        priority: todoMatch[1].toUpperCase() === 'BUG' ? 'high' : 'medium',
        agent,
        source,
        line: i + 1,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return todos
}

/**
 * Scan all agent locations for todos
 */
async function scanAllAgents(projectPath) {
  const results = {
    todos: [],
    agents: {},
  }

  for (const [agentId, agent] of Object.entries(AGENTS)) {
    const locations = agent.getLocations(projectPath)
    const agentTodos = []

    for (const location of locations) {
      try {
        const todos = await agent.parseFile(location, projectPath)
        agentTodos.push(...todos)
      } catch (err) {
        console.log(`[AgentTodos] Error scanning ${agentId} at ${location}:`, err.message)
      }
    }

    if (agentTodos.length > 0) {
      results.agents[agentId] = {
        name: agent.name,
        icon: agent.icon,
        color: agent.color,
        count: agentTodos.length,
      }
      results.todos.push(...agentTodos)
    }
  }

  console.log(`[AgentTodos] Found ${results.todos.length} todos from ${Object.keys(results.agents).length} agents`)

  return results
}

/**
 * Get agent metadata
 */
function getAgentInfo(agentId) {
  const agent = AGENTS[agentId]
  if (!agent) return null
  return {
    id: agentId,
    name: agent.name,
    icon: agent.icon,
    color: agent.color,
  }
}

/**
 * Get all agent metadata
 */
function getAllAgents() {
  return Object.entries(AGENTS).map(([id, agent]) => ({
    id,
    name: agent.name,
    icon: agent.icon,
    color: agent.color,
  }))
}

module.exports = {
  setMainWindow,
  scanAllAgents,
  getAgentInfo,
  getAllAgents,
  AGENTS,
}
