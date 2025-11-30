"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useContext } from "react";

// Types for the approval workflow
export type ToolApproval = {
  id: string;
  approved?: boolean;
};

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-denied"
  | "output-available";

// Context for confirmation state
type ConfirmationContextType = {
  approval: ToolApproval | undefined;
  state: ToolState | undefined;
  isRequested: boolean;
  isAccepted: boolean;
  isRejected: boolean;
};

const ConfirmationContext = createContext<ConfirmationContextType | null>(null);

const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("Confirmation components must be used within a Confirmation");
  }
  return context;
};

export type ConfirmationProps = ComponentProps<typeof Alert> & {
  approval?: ToolApproval;
  state?: ToolState;
};

export const Confirmation = ({
  approval,
  state,
  className,
  children,
  ...props
}: ConfirmationProps) => {
  // Don't render if no approval or in input states
  if (!approval || state === "input-streaming" || state === "input-available") {
    return null;
  }

  const isRequested = state === "approval-requested";
  const isResponded = state === "approval-responded" || state === "output-denied" || state === "output-available";
  const isAccepted = isResponded && approval.approved === true;
  const isRejected = isResponded && approval.approved === false;

  const contextValue: ConfirmationContextType = {
    approval,
    state,
    isRequested,
    isAccepted,
    isRejected,
  };

  return (
    <ConfirmationContext.Provider value={contextValue}>
      <Alert
        className={cn(
          "flex flex-col gap-3",
          isAccepted && "border-green-500/50 bg-green-50 dark:bg-green-950/20",
          isRejected && "border-red-500/50 bg-red-50 dark:bg-red-950/20",
          isRequested && "border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20",
          className
        )}
        {...props}
      >
        {children}
      </Alert>
    </ConfirmationContext.Provider>
  );
};

export type ConfirmationRequestProps = {
  children: ReactNode;
  className?: string;
};

export const ConfirmationRequest = ({ children, className }: ConfirmationRequestProps) => {
  const { isRequested } = useConfirmation();

  if (!isRequested) {
    return null;
  }

  return (
    <AlertDescription className={cn("text-sm", className)}>
      {children}
    </AlertDescription>
  );
};

export type ConfirmationAcceptedProps = {
  children: ReactNode;
  className?: string;
};

export const ConfirmationAccepted = ({ children, className }: ConfirmationAcceptedProps) => {
  const { isAccepted } = useConfirmation();

  if (!isAccepted) {
    return null;
  }

  return (
    <AlertDescription
      className={cn(
        "flex items-center gap-2 text-sm text-green-700 dark:text-green-400",
        className
      )}
    >
      {children}
    </AlertDescription>
  );
};

export type ConfirmationRejectedProps = {
  children: ReactNode;
  className?: string;
};

export const ConfirmationRejected = ({ children, className }: ConfirmationRejectedProps) => {
  const { isRejected } = useConfirmation();

  if (!isRejected) {
    return null;
  }

  return (
    <AlertDescription
      className={cn(
        "flex items-center gap-2 text-sm text-red-700 dark:text-red-400",
        className
      )}
    >
      {children}
    </AlertDescription>
  );
};

export type ConfirmationActionsProps = ComponentProps<"div">;

export const ConfirmationActions = ({
  className,
  children,
  ...props
}: ConfirmationActionsProps) => {
  const { isRequested } = useConfirmation();

  if (!isRequested) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center justify-end gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export type ConfirmationActionProps = ComponentProps<typeof Button>;

export const ConfirmationAction = ({
  className,
  ...props
}: ConfirmationActionProps) => (
  <Button
    className={cn("h-8 px-3 text-sm", className)}
    type="button"
    {...props}
  />
);
