import { getElectronAPI } from '../hooks/useElectronAPI';
import type { TodoItem } from '../types/tab';

type Result<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

type DirectoryEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
};

type FileExistsResult = {
  success: boolean;
  exists: boolean;
  error?: string;
};

type FileStat = {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  created: string;
  modified: string;
};

type SearchOptions = {
  filePattern?: string;
  maxResults?: number;
  caseSensitive?: boolean;
};

type SearchMatch = {
  file: string;
  line: number;
  content: string;
};

type GlobMatch = {
  path: string;
  relativePath: string;
  isDirectory: boolean;
};

type TreeOptions = {
  maxDepth?: number;
  includeHidden?: boolean;
};

type FileTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
};

type FileReadResult = {
  path: string;
  success: boolean;
  content?: string;
  error?: string;
};

export interface PatchFileParams {
  filePath: string;
  searchCode: string;
  replaceCode: string;
  description?: string;
  /** Maximum literal replacements to apply. Default 1. */
  maxReplacements?: number;
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class FileService {
  private getFilesApi() {
    const { api } = getElectronAPI();
    return api?.files ?? null;
  }

  private noApi<T = unknown>(): Result<T> {
    return { success: false, error: 'File operations not available (not in Electron)' };
  }

  async readFile(path: string, options?: { truncateAt?: number }): Promise<Result<string>> {
    const files = this.getFilesApi();
    if (!files?.readFile) return this.noApi();
    const result = (await files.readFile(path)) as Result<string>;
    if (!result.success || typeof result.data !== 'string') {
      return { success: false, error: result.error || 'Could not read file' };
    }

    let content = result.data;
    if (options?.truncateAt && content.length > options.truncateAt) {
      const originalLen = content.length;
      content = content.substring(0, options.truncateAt) + `\n... (truncated, file is ${originalLen} chars)`;
    }

    return { success: true, data: content };
  }

  async readFileFull(path: string): Promise<Result<string>> {
    return this.readFile(path);
  }

  async readMultiple(paths: string[]): Promise<Result<FileReadResult[]>> {
    const files = this.getFilesApi();
    if (!files?.readMultiple) return this.noApi();
    return (await files.readMultiple(paths)) as Result<FileReadResult[]>;
  }

  async listDirectory(path?: string): Promise<Result<DirectoryEntry[]>> {
    const files = this.getFilesApi();
    if (!files?.listDirectory) return this.noApi();
    return (await files.listDirectory(path)) as Result<DirectoryEntry[]>;
  }

  async listPrompts(): Promise<Result<string[]>> {
    const files = this.getFilesApi();
    if (!files?.listPrompts) return this.noApi();
    return (await files.listPrompts()) as Result<string[]>;
  }

  async readPrompt(name: string): Promise<Result<string>> {
    const files = this.getFilesApi();
    if (!files?.readPrompt) return this.noApi();
    return (await files.readPrompt(name)) as Result<string>;
  }

  async selectFile(path: string): Promise<Result<{ path: string; content: string }>> {
    const files = this.getFilesApi();
    if (!files?.selectFile) return this.noApi();
    return (await files.selectFile(path)) as Result<{ path: string; content: string }>;
  }

  async writeFile(path: string, content: string): Promise<Result<void>> {
    const files = this.getFilesApi();
    if (!files?.writeFile) return this.noApi();
    return (await files.writeFile(path, content)) as Result<void>;
  }

  async createFile(path: string, content: string = ''): Promise<Result<void>> {
    const files = this.getFilesApi();
    if (!files?.createFile) return this.noApi();
    return (await files.createFile(path, content)) as Result<void>;
  }

  async deleteFile(path: string): Promise<Result<void>> {
    const files = this.getFilesApi();
    if (!files?.deleteFile) return this.noApi();
    return (await files.deleteFile(path)) as Result<void>;
  }

  async renameFile(oldPath: string, newPath: string): Promise<Result<void>> {
    const files = this.getFilesApi();
    if (!files?.renameFile) return this.noApi();
    return (await files.renameFile(oldPath, newPath)) as Result<void>;
  }

  async copyFile(srcPath: string, destPath: string): Promise<Result<void>> {
    const files = this.getFilesApi();
    if (!files?.copyFile) return this.noApi();
    return (await files.copyFile(srcPath, destPath)) as Result<void>;
  }

  async createDirectory(path: string): Promise<Result<void>> {
    const files = this.getFilesApi();
    if (!files?.createDirectory) return this.noApi();
    return (await files.createDirectory(path)) as Result<void>;
  }

  async deleteDirectory(path: string): Promise<Result<void>> {
    const files = this.getFilesApi();
    if (!files?.deleteDirectory) return this.noApi();
    return (await files.deleteDirectory(path)) as Result<void>;
  }

  async exists(path: string): Promise<FileExistsResult> {
    const files = this.getFilesApi();
    if (!files?.exists) return { success: false, exists: false, error: 'File operations not available (not in Electron)' };
    return (await files.exists(path)) as FileExistsResult;
  }

  async stat(path: string): Promise<Result<FileStat>> {
    const files = this.getFilesApi();
    if (!files?.stat) return this.noApi();
    return (await files.stat(path)) as Result<FileStat>;
  }

  async searchInFiles(pattern: string, dirPath?: string, options?: SearchOptions): Promise<Result<SearchMatch[]>> {
    const files = this.getFilesApi();
    if (!files?.searchInFiles) return this.noApi();
    return (await files.searchInFiles(pattern, dirPath, options)) as Result<SearchMatch[]>;
  }

  async glob(pattern: string, dirPath?: string): Promise<Result<GlobMatch[]>> {
    const files = this.getFilesApi();
    if (!files?.glob) return this.noApi();
    return (await files.glob(pattern, dirPath)) as Result<GlobMatch[]>;
  }

  async findFiles(searchDir: string, filename: string): Promise<Result<string[]>> {
    const files = this.getFilesApi();
    if (!files?.findFiles) return this.noApi();
    return (await files.findFiles(searchDir, filename)) as Result<string[]>;
  }

  async getTree(path?: string, options?: TreeOptions): Promise<Result<FileTreeNode[]>> {
    const files = this.getFilesApi();
    if (!files?.getTree) return this.noApi();
    return (await files.getTree(path, options)) as Result<FileTreeNode[]>;
  }

  async getCwd(): Promise<Result<string>> {
    const files = this.getFilesApi();
    if (!files?.getCwd) return this.noApi();
    return (await files.getCwd()) as Result<string>;
  }

  async lintCode(code: string, filePath?: string): Promise<Result<{ valid: boolean; errors?: string[] }>> {
    const files = this.getFilesApi();
    if (!files?.lintCode) return this.noApi();
    return (await files.lintCode(code, filePath)) as Result<{ valid: boolean; errors?: string[] }>;
  }

  async patchFileBySearch(params: PatchFileParams): Promise<Result<{ originalContent: string; patchedContent: string }>> {
    const { filePath, searchCode, replaceCode, maxReplacements = 1 } = params;

    const readResult = await this.readFileFull(filePath);
    if (!readResult.success || typeof readResult.data !== 'string') {
      return { success: false, error: readResult.error || `Could not read file: ${filePath}` };
    }

    const originalContent = readResult.data;
    const occurrences = originalContent.split(searchCode).length - 1;
    if (occurrences === 0) {
      return { success: false, error: `Could not find the code to replace in ${filePath}. The file may have changed.` };
    }
    if (occurrences > 1 && maxReplacements === 1) {
      return { success: false, error: `Found ${occurrences} matches in ${filePath}. Refusing ambiguous patch; provide a more specific searchCode.` };
    }

    let patchedContent = originalContent;
    if (maxReplacements === 1) {
      patchedContent = originalContent.replace(searchCode, replaceCode);
    } else {
      const re = new RegExp(escapeRegExp(searchCode), 'g');
      let replaced = 0;
      patchedContent = originalContent.replace(re, (match) => {
        if (replaced < maxReplacements) {
          replaced += 1;
          return replaceCode;
        }
        return match;
      });
    }

    if (patchedContent === originalContent) {
      return { success: false, error: 'Patch produced no changes' };
    }

    const writeResult = await this.writeFile(filePath, patchedContent);
    if (!writeResult.success) {
      return { success: false, error: writeResult.error || `Failed to write file: ${filePath}` };
    }

    return {
      success: true,
      data: { originalContent, patchedContent },
    };
  }

  /**
   * Apply a patch with automatic history recording for undo support
   */
  async applyPatchWithHistory(
    filePath: string,
    originalContent: string,
    patchedContent: string,
    description: string,
    options?: { generatedBy?: string; lineNumber?: number }
  ): Promise<Result<{ success: boolean }>> {
    // Write the patched content
    const writeResult = await this.writeFile(filePath, patchedContent);
    if (!writeResult.success) {
      return { success: false, error: writeResult.error || `Failed to write file: ${filePath}` };
    }

    // Record in patch history for undo support
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.patchHistory?.record) {
      try {
        await electronAPI.patchHistory.record(
          filePath,
          originalContent,
          patchedContent,
          description,
          options
        );
        console.log('[FileService] Patch recorded in history:', description);
      } catch (err) {
        console.warn('[FileService] Failed to record patch history:', err);
        // Don't fail the operation if history recording fails
      }
    }

    return { success: true, data: { success: true } };
  }

  /**
   * Undo the last patch for a file
   */
  async undoPatch(filePath: string): Promise<Result<{ restoredContent: string }>> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.patchHistory?.undo) {
      return { success: false, error: 'Patch history not available' };
    }

    try {
      const result = await electronAPI.patchHistory.undo(filePath);
      if (result.success) {
        return { success: true, data: { restoredContent: result.restoredContent } };
      }
      return { success: false, error: result.error || 'Undo failed' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Undo failed' };
    }
  }

  /**
   * Redo the last undone patch for a file
   */
  async redoPatch(filePath: string): Promise<Result<{ restoredContent: string }>> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.patchHistory?.redo) {
      return { success: false, error: 'Patch history not available' };
    }

    try {
      const result = await electronAPI.patchHistory.redo(filePath);
      if (result.success) {
        return { success: true, data: { restoredContent: result.restoredContent } };
      }
      return { success: false, error: result.error || 'Redo failed' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Redo failed' };
    }
  }

  /**
   * Create a named checkpoint for a file
   */
  async createCheckpoint(filePath: string, name?: string): Promise<Result<{ checkpointId: string; name: string }>> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.patchHistory?.createCheckpoint) {
      return { success: false, error: 'Patch history not available' };
    }

    try {
      const result = await electronAPI.patchHistory.createCheckpoint(filePath, name);
      if (result.success) {
        return { success: true, data: { checkpointId: result.checkpointId, name: result.name } };
      }
      return { success: false, error: result.error || 'Failed to create checkpoint' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create checkpoint' };
    }
  }

  /**
   * Get patch history status for a file
   */
  async getPatchHistoryStatus(filePath: string): Promise<Result<{
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
    checkpointCount: number;
  }>> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.patchHistory?.getStatus) {
      return { success: false, error: 'Patch history not available' };
    }

    try {
      const result = await electronAPI.patchHistory.getStatus(filePath);
      if (result.success) {
        return {
          success: true,
          data: {
            canUndo: result.canUndo,
            canRedo: result.canRedo,
            undoCount: result.undoCount,
            redoCount: result.redoCount,
            checkpointCount: result.checkpointCount,
          },
        };
      }
      return { success: false, error: result.error || 'Failed to get status' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to get status' };
    }
  }

  // =====================
  // Todo File Operations
  // =====================

  private getTodosDir(projectPath: string): string {
    return `${projectPath}/.cluso/todos`;
  }

  private getTodoFilePath(projectPath: string, todoId: string): string {
    return `${this.getTodosDir(projectPath)}/${todoId}.json`;
  }

  async ensureTodosDir(projectPath: string): Promise<Result<void>> {
    const todosDir = this.getTodosDir(projectPath);
    const existsResult = await this.exists(todosDir);
    if (!existsResult.exists) {
      // Create .cluso directory first if needed
      const clusoDir = `${projectPath}/.cluso`;
      const clusoDirExists = await this.exists(clusoDir);
      if (!clusoDirExists.exists) {
        const createClusoResult = await this.createDirectory(clusoDir);
        if (!createClusoResult.success) {
          return createClusoResult;
        }
      }
      // Create todos directory
      return this.createDirectory(todosDir);
    }
    return { success: true };
  }

  async writeTodo(projectPath: string, todoItem: TodoItem): Promise<Result<void>> {
    const ensureResult = await this.ensureTodosDir(projectPath);
    if (!ensureResult.success) {
      return ensureResult;
    }

    const filePath = this.getTodoFilePath(projectPath, todoItem.id);
    const content = JSON.stringify(todoItem, null, 2);
    return this.writeFile(filePath, content);
  }

  async readTodo(projectPath: string, todoId: string): Promise<Result<TodoItem>> {
    const filePath = this.getTodoFilePath(projectPath, todoId);
    const result = await this.readFile(filePath);
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Could not read todo' };
    }
    try {
      const todoItem = JSON.parse(result.data) as TodoItem;
      return { success: true, data: todoItem };
    } catch (e) {
      return { success: false, error: 'Invalid todo JSON' };
    }
  }

  async listTodos(projectPath: string): Promise<Result<TodoItem[]>> {
    const todosDir = this.getTodosDir(projectPath);
    const existsResult = await this.exists(todosDir);
    if (!existsResult.exists) {
      // No todos directory yet, return empty list
      return { success: true, data: [] };
    }

    const dirResult = await this.listDirectory(todosDir);
    if (!dirResult.success || !dirResult.data) {
      return { success: false, error: dirResult.error || 'Could not list todos directory' };
    }

    const todos: TodoItem[] = [];
    for (const entry of dirResult.data) {
      if (entry.name.endsWith('.json') && !entry.isDirectory) {
        const todoId = entry.name.replace('.json', '');
        const todoResult = await this.readTodo(projectPath, todoId);
        if (todoResult.success && todoResult.data) {
          todos.push(todoResult.data);
        }
      }
    }

    // Sort by createdAt descending (newest first)
    todos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { success: true, data: todos };
  }

  async deleteTodo(projectPath: string, todoId: string): Promise<Result<void>> {
    const filePath = this.getTodoFilePath(projectPath, todoId);
    return this.deleteFile(filePath);
  }

  async updateTodo(projectPath: string, todoId: string, updates: Partial<TodoItem>): Promise<Result<TodoItem>> {
    const readResult = await this.readTodo(projectPath, todoId);
    if (!readResult.success || !readResult.data) {
      return { success: false, error: readResult.error || 'Todo not found' };
    }

    const updatedTodo: TodoItem = {
      ...readResult.data,
      ...updates,
      id: todoId, // Ensure ID is preserved
    };

    // If completing, set completedAt
    if (updates.completed === true && !readResult.data.completed) {
      updatedTodo.completedAt = new Date().toISOString();
    }
    // If uncompleting, clear completedAt
    if (updates.completed === false && readResult.data.completed) {
      updatedTodo.completedAt = undefined;
    }

    const writeResult = await this.writeTodo(projectPath, updatedTodo);
    if (!writeResult.success) {
      return { success: false, error: writeResult.error };
    }

    return { success: true, data: updatedTodo };
  }
}

export const fileService = new FileService();
