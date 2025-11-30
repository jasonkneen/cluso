"use client";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  useCarousel,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { ExternalLinkIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";

// Helper to extract hostname from URL
const getHostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
};

// Context for citation data
type CitationContextType = {
  sources: string[];
};

const CitationContext = createContext<CitationContextType | null>(null);

const useCitation = () => {
  const context = useContext(CitationContext);
  if (!context) {
    throw new Error("Citation components must be used within InlineCitationCard");
  }
  return context;
};

// Root InlineCitation component
export type InlineCitationProps = ComponentProps<"span">;

export const InlineCitation = ({ className, ...props }: InlineCitationProps) => (
  <span
    className={cn("inline", className)}
    {...props}
  />
);

// Text wrapper for cited content
export type InlineCitationTextProps = ComponentProps<"span">;

export const InlineCitationText = ({ className, ...props }: InlineCitationTextProps) => (
  <span
    className={cn("", className)}
    {...props}
  />
);

// Card wrapper using HoverCard
export type InlineCitationCardProps = ComponentProps<typeof HoverCard> & {
  sources?: string[];
};

export const InlineCitationCard = ({
  sources = [],
  children,
  ...props
}: InlineCitationCardProps) => (
  <CitationContext.Provider value={{ sources }}>
    <HoverCard openDelay={200} closeDelay={100} {...props}>
      {children}
    </HoverCard>
  </CitationContext.Provider>
);

// Trigger button with source badge
export type InlineCitationCardTriggerProps = ComponentProps<"button"> & {
  sources?: string[];
};

export const InlineCitationCardTrigger = ({
  sources = [],
  className,
  ...props
}: InlineCitationCardTriggerProps) => {
  const hostname = sources[0] ? getHostname(sources[0]) : "";
  const count = sources.length;

  return (
    <HoverCardTrigger asChild>
      <button
        className={cn(
          "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
          "bg-primary/10 text-primary hover:bg-primary/20",
          "transition-colors cursor-pointer",
          className
        )}
        type="button"
        {...props}
      >
        <span className="font-medium">{hostname}</span>
        {count > 1 && (
          <span className="text-primary/70">+{count - 1}</span>
        )}
      </button>
    </HoverCardTrigger>
  );
};

// Card body content
export type InlineCitationCardBodyProps = ComponentProps<"div">;

export const InlineCitationCardBody = ({ className, children, ...props }: InlineCitationCardBodyProps) => (
  <HoverCardContent
    className={cn("w-80 p-0", className)}
    align="start"
    {...props}
  >
    {children}
  </HoverCardContent>
);

// Carousel wrapper
export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export const InlineCitationCarousel = ({ className, ...props }: InlineCitationCarouselProps) => (
  <Carousel
    className={cn("w-full", className)}
    opts={{ loop: true }}
    {...props}
  />
);

// Carousel content
export type InlineCitationCarouselContentProps = ComponentProps<"div">;

export const InlineCitationCarouselContent = ({ className, ...props }: InlineCitationCarouselContentProps) => (
  <CarouselContent className={cn("", className)} {...props} />
);

// Carousel item
export type InlineCitationCarouselItemProps = ComponentProps<"div">;

export const InlineCitationCarouselItem = ({ className, children, ...props }: InlineCitationCarouselItemProps) => (
  <CarouselItem className={cn("p-4", className)} {...props}>
    {children}
  </CarouselItem>
);

// Carousel header with controls
export type InlineCitationCarouselHeaderProps = ComponentProps<"div">;

export const InlineCitationCarouselHeader = ({ className, children, ...props }: InlineCitationCarouselHeaderProps) => (
  <div
    className={cn(
      "flex items-center justify-between border-b px-4 py-2",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// Carousel index display
export type InlineCitationCarouselIndexProps = ComponentProps<"div">;

export const InlineCitationCarouselIndex = ({ className, children, ...props }: InlineCitationCarouselIndexProps) => {
  try {
    const { selectedIndex, scrollSnapCount } = useCarousel();
    return (
      <div className={cn("text-xs text-muted-foreground", className)} {...props}>
        {children || `${selectedIndex + 1}/${scrollSnapCount}`}
      </div>
    );
  } catch {
    // Not in carousel context
    return null;
  }
};

// Carousel prev button
export type InlineCitationCarouselPrevProps = ComponentProps<typeof Button>;

export const InlineCitationCarouselPrev = ({ className, ...props }: InlineCitationCarouselPrevProps) => (
  <CarouselPrevious
    className={cn(
      "static h-7 w-7 translate-x-0 translate-y-0",
      className
    )}
    variant="ghost"
    size="icon"
    {...props}
  >
    <ChevronLeftIcon className="h-4 w-4" />
  </CarouselPrevious>
);

// Carousel next button
export type InlineCitationCarouselNextProps = ComponentProps<typeof Button>;

export const InlineCitationCarouselNext = ({ className, ...props }: InlineCitationCarouselNextProps) => (
  <CarouselNext
    className={cn(
      "static h-7 w-7 translate-x-0 translate-y-0",
      className
    )}
    variant="ghost"
    size="icon"
    {...props}
  >
    <ChevronRightIcon className="h-4 w-4" />
  </CarouselNext>
);

// Source display
export type InlineCitationSourceProps = ComponentProps<"div"> & {
  title: string;
  url: string;
  description?: string;
};

export const InlineCitationSource = ({
  title,
  url,
  description,
  className,
  ...props
}: InlineCitationSourceProps) => (
  <div className={cn("space-y-2", className)} {...props}>
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 text-sm font-medium hover:underline"
    >
      <span className="flex-1 line-clamp-2">{title}</span>
      <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
    </a>
    <div className="text-xs text-muted-foreground">{getHostname(url)}</div>
    {description && (
      <p className="text-xs text-muted-foreground line-clamp-3">
        {description}
      </p>
    )}
  </div>
);

// Quote block
export type InlineCitationQuoteProps = ComponentProps<"blockquote">;

export const InlineCitationQuote = ({ className, ...props }: InlineCitationQuoteProps) => (
  <blockquote
    className={cn(
      "mt-3 border-l-2 border-muted-foreground/30 pl-3 text-xs italic text-muted-foreground",
      className
    )}
    {...props}
  />
);
