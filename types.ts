export interface StreamState {
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
}

export interface AudioVisualizerData {
  volume: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  selectedElement?: SelectedElement;
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
  x?: number;
  y?: number;
  rect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface AppState {
  html: string;
  messages: Message[];
  selectedElement: SelectedElement | null;
}