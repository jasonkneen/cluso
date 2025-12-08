export interface StreamState {
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
}

export interface AudioVisualizerData {
  volume: number;
}

export interface ToolUsage {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  
  // Execution tracking
  turnId?: string;       // Which turn this tool belongs to
  startTime?: number;    // When execution started
  endTime?: number;      // When execution completed
  duration?: number;     // Total execution time in milliseconds
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  selectedElement?: SelectedElement;
  model?: string;
  intent?: string;
  toolUsage?: ToolUsage[];
  reasoning?: string; // AI's reasoning/thinking content
  
  // Turn tracking for correlating related messages and tool calls
  turnId?: string;       // Unique ID for this turn (shared by user request + agent response)
  parentTurnId?: string; // Links to the user message this is responding to
  sequenceNumber?: number; // 0 for user, 1+ for agent turns and continuations
}

export interface ComponentSource {
  name: string;
  file: string;
  line: number;
  column: number;
}

export interface ElementSourceInfo {
  sources: ComponentSource[];
  summary: string; // e.g., "App.tsx (45-120)"
}

export interface SelectedElement {
  tagName: string;
  text?: string;
  id?: string;
  className?: string;
  xpath?: string;
  outerHTML?: string;
  attributes?: Record<string, string>;
  computedStyle?: {
    display?: string;
    position?: string;
    visibility?: string;
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
  };
  sourceLocation?: ElementSourceInfo | null;
  x?: number;
  y?: number;
  rect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  // Move mode - target position for repositioning
  targetPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  originalPosition?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface PatchApprovalState {
  pendingPatches: SourcePatch[];
  currentPatchIndex: number;
  isDialogOpen: boolean;
}

export interface SourcePatch {
  filePath: string;
  originalContent: string;
  patchedContent: string;
  lineNumber: number;
  generatedBy?: 'fast-apply' | 'gemini' | 'fast-path';
  durationMs?: number;
}

export interface AppState {
  html: string;
  messages: Message[];
  selectedElement: SelectedElement | null;
  patchApproval?: PatchApprovalState;
}