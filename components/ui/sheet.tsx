"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Sheet = Dialog;

const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogContent> & { side?: "right" | "left" }
>(({ className, side = "right", ...props }, ref) => {
  const sideClasses =
    side === "right"
      ? "sm:right-0 sm:left-auto"
      : "sm:left-0 sm:right-auto";
  return (
    <DialogContent
      ref={ref}
      className={cn(
        "sm:fixed sm:top-0 sm:bottom-0 sm:max-w-[400px] sm:w-[90vw] sm:rounded-none sm:border-l",
        sideClasses,
        className
      )}
      {...props}
    />
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = DialogHeader;
const SheetTitle = DialogTitle;
const SheetDescription = DialogDescription;
const SheetTrigger = DialogTrigger;

export { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };

