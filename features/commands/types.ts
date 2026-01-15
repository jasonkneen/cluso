/**
 * Commands Feature Types
 *
 * Type definitions for slash commands (/ commands) system.
 */

/**
 * A slash command available in the chat input
 */
export interface Command {
  name: string
  prompt: string
}

/**
 * Commands state managed by useCommandsState hook
 */
export interface CommandsState {
  availableCommands: Command[]
}

/**
 * Actions returned by useCommandsState hook
 */
export interface CommandsStateActions {
  setAvailableCommands: React.Dispatch<React.SetStateAction<Command[]>>
}
