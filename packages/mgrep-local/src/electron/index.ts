/**
 * Electron integration exports for mgrep-local
 */

export { MgrepLocalService } from './MgrepLocalService'

export type {
  // Worker types
  WorkerTaskType,
  WorkerTask,
  WorkerResult,
  WorkerInitializeTask,
  WorkerEmbedTask,
  WorkerEmbedBatchTask,
  WorkerDisposeTask,
  WorkerInitializeResult,
  WorkerEmbedResult,
  WorkerEmbedBatchResult,
  WorkerDisposeResult,

  // Service types
  MgrepServiceOptions,
  MgrepServiceStatus,
  MgrepServiceEvent,
  MgrepServiceEventListener,

  // IPC types
  MgrepIPCHandlers,
} from './types'

export { IPC_CHANNELS } from './types'
