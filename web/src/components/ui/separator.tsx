"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 border-0 data-horizontal:border-t data-horizontal:border-border data-horizontal:w-full data-vertical:border-l data-vertical:border-border data-vertical:self-stretch",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
