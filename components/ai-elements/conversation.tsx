"use client";

import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";
import { createContext, useContext, useRef, useEffect } from "react";

// Context for conversation state
type ConversationContextType = {
  scrollToBottom: () => void;
};

const ConversationContext = createContext<ConversationContextType | null>(null);

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error("useConversation must be used within a Conversation component");
  }
  return context;
};

export type ConversationProps = HTMLAttributes<HTMLDivElement> & {
  autoScroll?: boolean;
};

export const Conversation = ({
  className,
  children,
  autoScroll = true,
  ...props
}: ConversationProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  };

  return (
    <ConversationContext.Provider value={{ scrollToBottom }}>
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-hidden",
          className
        )}
        ref={contentRef}
        {...props}
      >
        {children}
      </div>
    </ConversationContext.Provider>
  );
};

export type ConversationContentProps = HTMLAttributes<HTMLDivElement>;

export const ConversationContent = ({
  className,
  children,
  ...props
}: ConversationContentProps) => {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when children change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [children]);

  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-4 overflow-y-auto p-4",
        className
      )}
      {...props}
    >
      {children}
      <div ref={endRef} />
    </div>
  );
};

export type ConversationHeaderProps = HTMLAttributes<HTMLDivElement>;

export const ConversationHeader = ({
  className,
  children,
  ...props
}: ConversationHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between border-b px-4 py-3",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type ConversationFooterProps = HTMLAttributes<HTMLDivElement>;

export const ConversationFooter = ({
  className,
  children,
  ...props
}: ConversationFooterProps) => (
  <div
    className={cn(
      "border-t px-4 py-3",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
