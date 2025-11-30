"use client";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { CircleIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";

// Types
export type LanguageModelUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
};

export type ModelId = string;

// Context for sharing data
type ContextDataType = {
  maxTokens: number;
  usedTokens: number;
  usage?: LanguageModelUsage;
  modelId?: ModelId;
  percentage: number;
  formattedUsed: string;
  formattedMax: string;
};

const ContextData = createContext<ContextDataType | null>(null);

const useContextData = () => {
  const context = useContext(ContextData);
  if (!context) {
    throw new Error("Context components must be used within a Context");
  }
  return context;
};

// Token formatting helper
const formatTokens = (tokens: number): string => {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(tokens);
};

// Cost formatting helper
const formatCost = (cost: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(cost);
};

// Simple cost calculation (rates per 1M tokens - approximate)
const MODEL_RATES: Record<string, { input: number; output: number; cached?: number }> = {
  "gpt-4": { input: 30, output: 60 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "claude-3-opus": { input: 15, output: 75 },
  "claude-3-sonnet": { input: 3, output: 15 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  "claude-3.5-sonnet": { input: 3, output: 15 },
  "claude-3.5-haiku": { input: 0.8, output: 4 },
  "gemini-pro": { input: 0.5, output: 1.5 },
  "gemini-1.5-pro": { input: 3.5, output: 10.5 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
};

const calculateCost = (
  modelId: string | undefined,
  usage: LanguageModelUsage | undefined
): number | null => {
  if (!modelId || !usage) return null;

  // Extract model name from full ID (e.g., "openai:gpt-4" -> "gpt-4")
  const modelName = modelId.split(":").pop() || modelId;
  const rates = MODEL_RATES[modelName];

  if (!rates) return null;

  const inputTokens = usage.promptTokens || 0;
  const outputTokens = usage.completionTokens || 0;
  const cachedTokens = usage.cachedTokens || 0;

  const inputCost = ((inputTokens - cachedTokens) / 1_000_000) * rates.input;
  const outputCost = (outputTokens / 1_000_000) * rates.output;
  const cachedCost = (cachedTokens / 1_000_000) * (rates.cached || rates.input * 0.1);

  return inputCost + outputCost + cachedCost;
};

// Progress Ring Component
const ProgressRing = ({ percentage }: { percentage: number }) => {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg className="size-10 -rotate-90" viewBox="0 0 40 40">
      <circle
        className="text-muted stroke-current"
        cx="20"
        cy="20"
        fill="none"
        r={radius}
        strokeWidth="4"
      />
      <circle
        className="stroke-current transition-all duration-300"
        cx="20"
        cy="20"
        fill="none"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        strokeWidth="4"
        style={{
          color: percentage > 90 ? "hsl(var(--destructive))" : percentage > 70 ? "hsl(var(--warning, 38 92% 50%))" : "currentColor",
        }}
      />
    </svg>
  );
};

// Main Context Component
export type ContextProps = ComponentProps<typeof HoverCard> & {
  maxTokens: number;
  usedTokens: number;
  usage?: LanguageModelUsage;
  modelId?: ModelId;
};

export const Context = ({
  maxTokens,
  usedTokens,
  usage,
  modelId,
  children,
  ...props
}: ContextProps) => {
  const percentage = Math.min((usedTokens / maxTokens) * 100, 100);
  const formattedUsed = formatTokens(usedTokens);
  const formattedMax = formatTokens(maxTokens);

  const contextValue: ContextDataType = {
    maxTokens,
    usedTokens,
    usage,
    modelId,
    percentage,
    formattedUsed,
    formattedMax,
  };

  return (
    <ContextData.Provider value={contextValue}>
      <HoverCard {...props}>{children}</HoverCard>
    </ContextData.Provider>
  );
};

// Trigger Component
export type ContextTriggerProps = ComponentProps<typeof Button> & {
  children?: ReactNode;
};

export const ContextTrigger = ({ children, className, ...props }: ContextTriggerProps) => {
  const { percentage, formattedUsed } = useContextData();

  return (
    <HoverCardTrigger asChild>
      {children || (
        <Button
          className={cn("h-8 gap-1.5 px-2 text-xs", className)}
          size="sm"
          variant="ghost"
          {...props}
        >
          <CircleIcon className="size-3" />
          <span>{Math.round(percentage)}%</span>
          <span className="text-muted-foreground">({formattedUsed})</span>
        </Button>
      )}
    </HoverCardTrigger>
  );
};

// Content Component
export type ContextContentProps = ComponentProps<typeof HoverCardContent>;

export const ContextContent = ({ className, children, ...props }: ContextContentProps) => (
  <HoverCardContent
    className={cn("w-72 p-0", className)}
    {...props}
  >
    {children}
  </HoverCardContent>
);

// Content Header
export type ContextContentHeaderProps = ComponentProps<"div">;

export const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps) => {
  const { percentage, formattedUsed, formattedMax } = useContextData();

  return (
    <div className={cn("flex items-center gap-3 p-4", className)} {...props}>
      {children || (
        <>
          <ProgressRing percentage={percentage} />
          <div className="flex flex-col">
            <span className="text-lg font-semibold">{Math.round(percentage)}%</span>
            <span className="text-xs text-muted-foreground">
              {formattedUsed} / {formattedMax} tokens
            </span>
          </div>
        </>
      )}
    </div>
  );
};

// Content Body
export type ContextContentBodyProps = ComponentProps<"div">;

export const ContextContentBody = ({ className, children, ...props }: ContextContentBodyProps) => (
  <div className={cn("space-y-2 px-4 pb-4", className)} {...props}>
    {children}
  </div>
);

// Content Footer
export type ContextContentFooterProps = ComponentProps<"div">;

export const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps) => {
  const { modelId, usage } = useContextData();
  const cost = calculateCost(modelId, usage);

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t bg-muted/50 px-4 py-3 text-xs",
        className
      )}
      {...props}
    >
      {children || (
        <>
          <span className="text-muted-foreground">Estimated cost</span>
          <span className="font-medium">
            {cost !== null ? formatCost(cost) : "N/A"}
          </span>
        </>
      )}
    </div>
  );
};

// Usage Components
type UsageRowProps = ComponentProps<"div"> & {
  label: string;
  tokens: number | undefined;
  costRate?: number;
};

const UsageRow = ({ label, tokens, className, children, ...props }: UsageRowProps) => {
  if (!tokens) return null;

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      {children || (
        <>
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{formatTokens(tokens)}</span>
        </>
      )}
    </div>
  );
};

export type ContextInputUsageProps = ComponentProps<"div">;

export const ContextInputUsage = ({ children, ...props }: ContextInputUsageProps) => {
  const { usage } = useContextData();
  return (
    <UsageRow label="Input tokens" tokens={usage?.promptTokens} {...props}>
      {children}
    </UsageRow>
  );
};

export type ContextOutputUsageProps = ComponentProps<"div">;

export const ContextOutputUsage = ({ children, ...props }: ContextOutputUsageProps) => {
  const { usage } = useContextData();
  return (
    <UsageRow label="Output tokens" tokens={usage?.completionTokens} {...props}>
      {children}
    </UsageRow>
  );
};

export type ContextReasoningUsageProps = ComponentProps<"div">;

export const ContextReasoningUsage = ({ children, ...props }: ContextReasoningUsageProps) => {
  const { usage } = useContextData();
  return (
    <UsageRow label="Reasoning tokens" tokens={usage?.reasoningTokens} {...props}>
      {children}
    </UsageRow>
  );
};

export type ContextCacheUsageProps = ComponentProps<"div">;

export const ContextCacheUsage = ({ children, ...props }: ContextCacheUsageProps) => {
  const { usage } = useContextData();
  return (
    <UsageRow label="Cached tokens" tokens={usage?.cachedTokens} {...props}>
      {children}
    </UsageRow>
  );
};
