import { getElectronAPI } from '../hooks/useElectronAPI';

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
}

export const fileService = new FileService();
