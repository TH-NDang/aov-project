import type { ReactNode } from "react"
import { Badge } from "@aov/ui/components/badge"
import { HeroLaneIcon, HeroRoleIcon } from "@aov/ui/components/hero-marks"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { POSITIONS, ROLES, type Position, type Role } from "@/lib/hero-types"

function ClassificationBadge({
  label,
  group,
  icon,
  children,
}: {
  label: string
  group: string
  icon: ReactNode
  children?: ReactNode
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            tabIndex={0}
            aria-label={`${group}: ${label}`}
            className="min-h-8 min-w-8 gap-1.5 px-1.5 focus-visible:outline-2 focus-visible:outline-ring sm:px-2"
          >
            {icon}
            <span className="sr-only sm:not-sr-only">{label}</span>
            {children}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {group}: {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function HeroRoleBadge({ role, children }: { role: Role; children?: ReactNode }) {
  return (
    <ClassificationBadge label={ROLES[role]} group="Vai trò" icon={<HeroRoleIcon role={role} />}>
      {children}
    </ClassificationBadge>
  )
}

export function HeroPositionBadges({ positions }: { positions: Position[] }) {
  if (!positions.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vị trí đi">
      {positions.map((position) => (
        <ClassificationBadge
          key={position}
          group="Vị trí đi"
          label={POSITIONS[position]}
          icon={<HeroLaneIcon lane={position} />}
        />
      ))}
    </div>
  )
}
