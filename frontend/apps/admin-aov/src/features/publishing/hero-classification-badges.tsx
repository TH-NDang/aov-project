import type { ReactNode } from "react"
import { Badge } from "@aov/ui/components/badge"
import { HeroLaneIcon } from "@aov/ui/components/hero-lane-icon"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@aov/ui/components/tooltip"
import { MediaImage } from "@/components/media-image"
import { ROLES, type Role, type Skill } from "./types"
import { positions, positionLanes, recommendedHeroPositions } from "./hero-classifications"
export { recommendedHeroPositions } from "./hero-classifications"

const roleIcons: Record<Role, string> = {
  TANK: "do-don",
  WARRIOR: "dau-si",
  ASSASSIN: "sat-thu",
  MAGE: "phap-su",
  MARKSMAN: "xa-thu",
  SUPPORT: "tro-thu",
}

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
    <ClassificationBadge
      label={ROLES[role]}
      group="Vai trò"
      icon={
        <MediaImage
          path={`${import.meta.env?.BASE_URL ?? "/"}images/hero/vai-tro/${roleIcons[role]}.png`}
          alt=""
          className="size-5 shrink-0 object-contain"
        />
      }
    >
      {children}
    </ClassificationBadge>
  )
}

export function HeroPositionBadges({ skills }: { skills: Skill[] }) {
  const values = recommendedHeroPositions(skills)
  if (!values.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Vị trí game gợi ý">
      {values.map((position) => (
        <ClassificationBadge
          key={position}
          group="Vị trí game gợi ý"
          label={positions[position]}
          icon={<HeroLaneIcon lane={positionLanes[position]} />}
        />
      ))}
    </div>
  )
}
