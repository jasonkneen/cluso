const { ipcMain } = require('electron')
const fs = require('fs').promises
const path = require('path')
const os = require('os')

function registerTabDataHandlers() {
  const globalDataDir = path.join(os.homedir(), '.cluso', 'data')
  console.log('[TabData] Global data dir:', globalDataDir)

  // Get the data directory for a project (or global if no project)
  function getDataDir(projectPath) {
    if (projectPath) {
      return path.join(projectPath, '.cluso')
    }
    return globalDataDir
  }

  // Ensure tab data directory exists
  ipcMain.handle('tabdata:ensureDir', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(dataDir, { recursive: true })
      console.log('[TabData] Directory ensured:', dataDir)
      return { success: true, path: dataDir }
    } catch (error) {
      console.error('[TabData] Error creating directory:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save kanban data - each board gets its own file based on boardId
  ipcMain.handle('tabdata:saveKanban', async (event, projectPath, data) => {
    console.log('[TabData] saveKanban called with projectPath:', projectPath, 'boardId:', data?.boardId)
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(path.join(dataDir, 'kanban'), { recursive: true })

      // Use boardId for unique filename, fallback to 'default'
      const boardId = data?.boardId || 'default'
      const filePath = path.join(dataDir, 'kanban', `${boardId}.json`)

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      console.log('[TabData] Kanban saved to:', filePath)
      return { success: true, path: filePath, boardId }
    } catch (error) {
      console.error('[TabData] Error saving kanban:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Load all kanban boards from directory
  ipcMain.handle('tabdata:loadKanban', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const kanbanDir = path.join(dataDir, 'kanban')

      // Check if kanban directory exists
      try {
        await fs.access(kanbanDir)
      } catch {
        // No kanban directory yet
        return { success: true, data: [] }
      }

      // Read all kanban files
      const files = await fs.readdir(kanbanDir)
      const boards = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(kanbanDir, file)
            const content = await fs.readFile(filePath, 'utf-8')
            const board = JSON.parse(content)
            boards.push(board)
            console.log('[TabData] Loaded kanban board:', board.boardId, board.boardTitle)
          } catch (e) {
            console.error('[TabData] Error loading kanban file:', file, e.message)
          }
        }
      }

      console.log('[TabData] Loaded', boards.length, 'kanban boards')
      return { success: true, data: boards }
    } catch (error) {
      console.error('[TabData] Error loading kanban:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save todos data
  ipcMain.handle('tabdata:saveTodos', async (event, projectPath, data) => {
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(dataDir, { recursive: true })
      const filePath = path.join(dataDir, 'todos.json')
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      console.log('[TabData] Todos saved to:', filePath)
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[TabData] Error saving todos:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Load todos data
  ipcMain.handle('tabdata:loadTodos', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const filePath = path.join(dataDir, 'todos.json')
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      console.log('[TabData] Todos loaded from:', filePath)
      return { success: true, data }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, data: null }
      }
      console.error('[TabData] Error loading todos:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save notes data
  ipcMain.handle('tabdata:saveNotes', async (event, projectPath, data) => {
    try {
      const dataDir = getDataDir(projectPath)
      await fs.mkdir(dataDir, { recursive: true })
      const filePath = path.join(dataDir, 'notes.json')
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      console.log('[TabData] Notes saved to:', filePath)
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[TabData] Error saving notes:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Load notes data
  ipcMain.handle('tabdata:loadNotes', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const filePath = path.join(dataDir, 'notes.json')
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      console.log('[TabData] Notes loaded from:', filePath)
      return { success: true, data }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, data: null }
      }
      console.error('[TabData] Error loading notes:', error.message)
      return { success: false, error: error.message }
    }
  })

  // List all tab data files in a project
  ipcMain.handle('tabdata:list', async (event, projectPath) => {
    try {
      const dataDir = getDataDir(projectPath)
      const files = await fs.readdir(dataDir).catch(() => [])
      const tabFiles = files.filter(f => ['kanban.json', 'todos.json', 'notes.json'].includes(f))
      return { success: true, data: tabFiles, path: dataDir }
    } catch (error) {
      console.error('[TabData] Error listing files:', error.message)
      return { success: false, error: error.message }
    }
  })
}

module.exports = registerTabDataHandlers
