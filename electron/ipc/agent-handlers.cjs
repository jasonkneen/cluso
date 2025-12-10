const { ipcMain } = require('electron')
const backgroundValidator = require('../background-validator.cjs')
const agentTodos = require('../agent-todos.cjs')

function registerAgentHandlers() {
  // Background validator handlers
  ipcMain.handle('validator:trigger', async (event, projectPath) => {
    return backgroundValidator.triggerValidation(projectPath)
  })

  ipcMain.handle('validator:get-state', async (event, projectPath) => {
    return backgroundValidator.getValidationState(projectPath)
  })

  ipcMain.handle('validator:clear', async (event, projectPath) => {
    return backgroundValidator.clearValidationState(projectPath)
  })

  // Agent Todos handlers
  ipcMain.handle('agent-todos:scan', async (event, projectPath) => {
    return agentTodos.scanTodos(projectPath)
  })

  ipcMain.handle('agent-todos:agents', async () => {
    return agentTodos.getAvailableAgents()
  })

  ipcMain.handle('agent-todos:agent-info', async (event, agentId) => {
    return agentTodos.getAgentInfo(agentId)
  })
}

module.exports = registerAgentHandlers
