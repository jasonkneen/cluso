"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BookmarkIcon, type LucideProps } from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

export type CheckpointProps = HTMLAttributes<HTMLDivElement>;

export const Checkpoint = ({ className, children, ...props }: CheckpointProps) => (
  <div
    className={cn(
      "flex w-full items-center gap-2 py-2",
      className
    )}
    {...props}
  >
    {children}
    <Separator className="flex-1" />
  </div>
);

export type CheckpointIconProps = LucideProps & {
  children?: ReactNode;
};

export const CheckpointIcon = ({ children, className, ...props }: CheckpointIconProps) => {
  if (children) {
    return <>{children}</>;
  }

  return (
    <BookmarkIcon
      className={cn("size-4 text-muted-foreground", className)}
      {...props}
    />
  );
};

export type CheckpointTriggerProps = ComponentProps<typeof Button>;

export const CheckpointTrigger = ({
  children,
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: CheckpointTriggerProps) => (
  <Button
    aria-label="Restore to checkpoint"
    className={cn(
      "h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground",
      className
    )}
    size={size}
    type="button"
    variant={variant}
    {...props}
  >
    {children}
  </Button>
);

// Export types for external use
export type { CheckpointType } from "./checkpoint-types";
