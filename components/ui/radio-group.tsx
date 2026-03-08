"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RadioGroupProps = React.ComponentPropsWithoutRef<"div"> & {
  value: string;
  onValueChange: (v: string) => void;
};

function RadioGroup({ className, children, value, onValueChange, ...props }: RadioGroupProps) {
  return (
    <div className={cn("grid gap-2", className)} role="radiogroup" {...props}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type !== RadioGroupItem) return child;
        return React.cloneElement(child as React.ReactElement<RadioGroupItemProps>, {
          checked: (child.props as RadioGroupItemProps).value === value,
          onChange: () => onValueChange((child.props as RadioGroupItemProps).value),
        });
      })}
    </div>
  );
}

type RadioGroupItemProps = React.ComponentPropsWithoutRef<"input"> & { value: string };

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, checked, onChange, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="radio"
        value={value}
        checked={checked}
        onChange={onChange}
        className={cn(
          "mt-1 size-4 shrink-0 cursor-pointer rounded-full border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };

