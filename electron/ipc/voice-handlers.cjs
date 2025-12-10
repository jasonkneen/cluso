const { ipcMain } = require('electron')
const fs = require('fs').promises
const path = require('path')
const os = require('os')

function registerVoiceHandlers() {
  // Voice logging handlers
  const voiceLogDir = path.join(os.homedir(), '.cluso', 'voice', 'logs')
  const learningsDir = path.join(os.homedir(), '.cluso', 'learning')

  // Ensure voice log directories exist
  ipcMain.handle('voice:ensureLogDir', async () => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      await fs.mkdir(learningsDir, { recursive: true })
      console.log('[Voice] Log directories ensured:', voiceLogDir)
      return { success: true, path: voiceLogDir }
    } catch (error) {
      console.error('[Voice] Error creating log directories:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Save voice session log
  ipcMain.handle('voice:saveLog', async (event, sessionId, content) => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      const filePath = path.join(voiceLogDir, `${sessionId}.json`)
      await fs.writeFile(filePath, content, 'utf-8')
      console.log('[Voice] Saved session log:', sessionId)
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[Voice] Error saving log:', error.message)
      return { success: false, error: error.message }
    }
  })

  // List voice session logs
  ipcMain.handle('voice:listLogs', async () => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      const files = await fs.readdir(voiceLogDir)
      const logs = files.filter(f => f.endsWith('.json')).map(f => ({
        id: f.replace('.json', ''),
        path: path.join(voiceLogDir, f)
      }))
      return { success: true, logs }
    } catch (error) {
      console.error('[Voice] Error listing logs:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Read voice session log
  ipcMain.handle('voice:readLog', async (event, sessionId) => {
    try {
      const filePath = path.join(voiceLogDir, `${sessionId}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      console.error('[Voice] Error reading log:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Get unprocessed logs (not yet learned from)
  ipcMain.handle('voice:getUnprocessedLogs', async () => {
    try {
      await fs.mkdir(voiceLogDir, { recursive: true })
      const files = await fs.readdir(voiceLogDir)
      const logs = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const content = await fs.readFile(path.join(voiceLogDir, file), 'utf-8')
          const data = JSON.parse(content)
          if (!data.processed) {
            logs.push({
              id: file.replace('.json', ''),
              path: path.join(voiceLogDir, file),
              timestamp: data.timestamp
            })
          }
        } catch (e) {
          // Skip invalid files
        }
      }

      // Sort by timestamp (oldest first)
      logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      return { success: true, logs }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Mark logs as processed
  ipcMain.handle('voice:markProcessed', async (event, sessionIds) => {
    try {
      for (const id of sessionIds) {
        const filePath = path.join(voiceLogDir, `${id}.json`)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const data = JSON.parse(content)
          data.processed = true
          await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
        } catch (e) {
          console.error(`[Voice] Failed to mark log ${id} as processed:`, e.message)
        }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })

  // Save learnings
  ipcMain.handle('voice:saveLearnings', async (event, content) => {
    try {
      await fs.mkdir(learningsDir, { recursive: true })
      const filePath = path.join(learningsDir, 'voice_learnings.md')
      await fs.writeFile(filePath, content, 'utf-8')
      console.log('[Voice] Saved learnings')
      return { success: true, path: filePath }
    } catch (error) {
      console.error('[Voice] Error saving learnings:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Read learnings
  ipcMain.handle('voice:readLearnings', async () => {
    try {
      const filePath = path.join(learningsDir, 'voice_learnings.md')
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        return { success: true, content }
      } catch (e) {
        if (e.code === 'ENOENT') return { success: true, content: '' }
        throw e
      }
    } catch (error) {
      console.error('[Voice] Error reading learnings:', error.message)
      return { success: false, error: error.message }
    }
  })

  // Get log path
  ipcMain.handle('voice:getLogPath', async () => {
    return { success: true, path: voiceLogDir }
  })

  // Get learnings path
  ipcMain.handle('voice:getLearningsPath', async () => {
    return { success: true, path: learningsDir }
  })
}

module.exports = registerVoiceHandlers
