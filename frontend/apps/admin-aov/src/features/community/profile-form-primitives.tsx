import type { ComponentType } from "react"
import { Button } from "@aov/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"

export function ProfileIconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  expanded,
  controls,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
  expanded?: boolean
  controls?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={controls}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
