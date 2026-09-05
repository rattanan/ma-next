"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { FieldHelp, textFromNode } from "@/components/ui/field-help"
import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants> & {
      helpDescription?: string
      helpExample?: string
      helpLabel?: string
      showHelp?: boolean
    }
>(({ children, className, helpDescription, helpExample, helpLabel, showHelp = true, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  >
    <span className="inline-flex items-center gap-1.5">
      {children}
      {showHelp && (helpLabel || textFromNode(children)) && (
        <FieldHelp
          label={helpLabel || textFromNode(children)}
          description={helpDescription}
          example={helpExample}
        />
      )}
    </span>
  </LabelPrimitive.Root>
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
