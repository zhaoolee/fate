import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../../lib/utils";

function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-muted-foreground text-sm font-semibold leading-none", className)}
      {...props}
    />
  );
}

export { Label };
