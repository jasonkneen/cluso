interface GitResult<T = string> {
  success: boolean
  data?: T
  error?: string
}

interface GitStatus {
  files: { status: string; file: string }[]
  hasChanges: boolean
}

interface ElectronGitAPI {
  getCurrentBranch: () => Promise<GitResult>
  getBranches: () => Promise<GitResult<string[]>>
  checkout: (branch: string) => Promise<GitResult>
  createBranch: (name: string) => Promise<GitResult>
  getStatus: () => Promise<GitResult<GitStatus>>
  commit: (message: string) => Promise<GitResult>
  push: () => Promise<GitResult>
  pull: () => Promise<GitResult>
  stash: () => Promise<GitResult>
  stashWithMessage: (message: string) => Promise<GitResult>
  stashPop: () => Promise<GitResult>
}

interface DirectoryEntry {
  name: string
  path: string
  isDirectory: boolean
}

interface ElectronFilesAPI {
  readFile: (path: string) => Promise<GitResult>
  selectFile: (path: string) => Promise<GitResult<{path: string; content: string}>>
  listDirectory: (path?: string) => Promise<GitResult<DirectoryEntry[]>>
  listPrompts: () => Promise<GitResult<string[]>>
  readPrompt: (name: string) => Promise<GitResult>
}

interface ElectronAPI {
  git: ElectronGitAPI
  files: ElectronFilesAPI
  getWebviewPreloadPath: () => Promise<string>
  isElectron: boolean
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        preload?: string
        allowpopups?: string
        webpreferences?: string
        partition?: string
        httpreferrer?: string
        useragent?: string
        disablewebsecurity?: string
        nodeintegration?: string
        nodeintegrationinsubframes?: string
        plugins?: string
        enableremotemodule?: string
      }, HTMLElement>
    }
  }
}

export {}
