// Voice conversation logger - logs sessions to ~/.cluso/voice/logs/

export interface VoiceLogEntry {
  timestamp: string
  type: 'session_start' | 'session_end' | 'user_input' | 'ai_response' | 'tool_call' | 'error' | 'clarification'
  data: Record<string, unknown>
}

export interface VoiceSession {
  sessionId: string
  startTime: string
  endTime?: string
  context: {
    projectFolder: string
    currentUrl?: string
    selectedElement?: {
      tagName: string
      text?: string
      className?: string
    } | null
  }
  entries: VoiceLogEntry[]
  summary?: {
    totalUserInputs: number
    totalAiResponses: number
    toolCallsCount: number
    errorsCount: number
    clarificationsCount: number
  }
}

// Generate session ID
function generateSessionId(): string {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '')
  const random = Math.random().toString(36).substring(2, 6)
  return `voice_${dateStr}_${timeStr}_${random}`
}

// Voice logger class
export class VoiceLogger {
  private session: VoiceSession | null = null
  private isElectron: boolean

  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron
  }

  // Initialize - ensure log directory exists
  async init(): Promise<void> {
    if (this.isElectron && (window as any).electronAPI?.voice) {
      await (window as any).electronAPI.voice.ensureLogDir()
    }
  }

  // Start a new session
  startSession(context: VoiceSession['context']): string {
    const sessionId = generateSessionId()
    this.session = {
      sessionId,
      startTime: new Date().toISOString(),
      context,
      entries: [],
      summary: {
        totalUserInputs: 0,
        totalAiResponses: 0,
        toolCallsCount: 0,
        errorsCount: 0,
        clarificationsCount: 0
      }
    }

    this.addEntry({
      timestamp: new Date().toISOString(),
      type: 'session_start',
      data: { context }
    })

    console.log('[VoiceLogger] Session started:', sessionId)
    return sessionId
  }

  // End the current session
  async endSession(): Promise<void> {
    if (!this.session) return

    this.session.endTime = new Date().toISOString()
    this.addEntry({
      timestamp: new Date().toISOString(),
      type: 'session_end',
      data: {
        duration: this.getSessionDuration(),
        summary: this.session.summary
      }
    })

    await this.saveSession()
    console.log('[VoiceLogger] Session ended:', this.session.sessionId)
    this.session = null
  }

  // Log user input (voice or text)
  logUserInput(input: {
    type: 'voice' | 'text'
    content?: string // For text, or transcription if available
    audioData?: boolean // Whether audio was sent
  }): void {
    if (!this.session) return

    this.addEntry({
      timestamp: new Date().toISOString(),
      type: 'user_input',
      data: input
    })

    if (this.session.summary) {
      this.session.summary.totalUserInputs++
    }
  }

  // Log AI response
  logAiResponse(response: {
    type: 'audio' | 'text' | 'tool_call'
    content?: string // Text or transcription
    toolName?: string
    toolArgs?: Record<string, unknown>
    toolResult?: unknown
  }): void {
    if (!this.session) return

    const entryType = response.type === 'tool_call' ? 'tool_call' : 'ai_response'

    this.addEntry({
      timestamp: new Date().toISOString(),
      type: entryType,
      data: response
    })

    if (this.session.summary) {
      if (response.type === 'tool_call') {
        this.session.summary.toolCallsCount++
      } else {
        this.session.summary.totalAiResponses++
      }
    }
  }

  // Log an error
  logError(error: {
    message: string
    context?: string
    toolName?: string
    selector?: string
  }): void {
    if (!this.session) return

    this.addEntry({
      timestamp: new Date().toISOString(),
      type: 'error',
      data: error
    })

    if (this.session.summary) {
      this.session.summary.errorsCount++
    }
  }

  // Log clarification (when AI asks for clarification or user corrects)
  logClarification(clarification: {
    reason: string
    originalRequest?: string
    clarifiedRequest?: string
  }): void {
    if (!this.session) return

    this.addEntry({
      timestamp: new Date().toISOString(),
      type: 'clarification',
      data: clarification
    })

    if (this.session.summary) {
      this.session.summary.clarificationsCount++
    }
  }

  // Update context (e.g., when URL changes)
  updateContext(updates: Partial<VoiceSession['context']>): void {
    if (!this.session) return
    this.session.context = { ...this.session.context, ...updates }
  }

  // Get current session ID
  getSessionId(): string | null {
    return this.session?.sessionId || null
  }

  // Check if session is active
  isActive(): boolean {
    return this.session !== null
  }

  // Private: Add entry to session
  private addEntry(entry: VoiceLogEntry): void {
    if (!this.session) return
    this.session.entries.push(entry)

    // Auto-save periodically (every 10 entries)
    if (this.session.entries.length % 10 === 0) {
      this.saveSession()
    }
  }

  // Private: Calculate session duration in seconds
  private getSessionDuration(): number {
    if (!this.session) return 0
    const start = new Date(this.session.startTime).getTime()
    const end = new Date().getTime()
    return Math.round((end - start) / 1000)
  }

  // Private: Save session to file
  private async saveSession(): Promise<void> {
    if (!this.session) return

    try {
      if (this.isElectron && (window as any).electronAPI?.voice) {
        const content = JSON.stringify(this.session, null, 2)
        await (window as any).electronAPI.voice.saveLog(this.session.sessionId, content)
        console.log('[VoiceLogger] Session saved:', this.session.sessionId)
      } else {
        console.log('[VoiceLogger] Not in Electron, skipping save')
      }
    } catch (err) {
      console.error('[VoiceLogger] Failed to save session:', err)
    }
  }
}

// Singleton instance
export const voiceLogger = new VoiceLogger()
