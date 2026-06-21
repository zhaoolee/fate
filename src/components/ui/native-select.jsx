import * as React from "react";
import { cn } from "../../lib/utils";

function NativeSelect({ className, children, ...props }) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input bg-background text-foreground flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { NativeSelect };
