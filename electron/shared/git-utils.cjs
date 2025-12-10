const { spawnSync } = require('child_process')
const path = require('path')

// Safe git exec with args array - prevents command injection
function gitExecSafe(args) {
  try {
    const cwd = process.cwd()
    const result = spawnSync('git', args, { cwd, encoding: 'utf-8' })
    if (result.status !== 0) {
      return { success: false, error: result.stderr || 'Git command failed' }
    }
    return { success: true, data: (result.stdout || '').trim() }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// Validate git branch/ref names to prevent injection
function validateGitRef(ref) {
  if (!ref || typeof ref !== 'string') {
    return { valid: false, error: 'Invalid ref name' }
  }
  // Git ref names can't contain: space, ~, ^, :, ?, *, [, \, ..
  // Also block shell metacharacters
  const invalidChars = /[\s~^:?*\[\]\\;&|`$()'"<>]/ 
  if (invalidChars.test(ref) || ref.includes('..')) {
    return { valid: false, error: 'Invalid characters in ref name' }
  }
  if (ref.startsWith('-')) {
    return { valid: false, error: 'Ref name cannot start with dash' }
  }
  return { valid: true, ref: ref.trim() }
}

module.exports = {
  gitExecSafe,
  validateGitRef
}

