import type { HeroLane } from "@aov/ui/components/hero-marks"

export const positions = {
  top: "Đường Tà thần Caesar",
  mid: "Đường giữa",
  rung: "Rừng",
  "rong-ad": "Đường Rồng",
  "tro-thu": "Hỗ trợ",
} as const
type Position = keyof typeof positions

export const positionLanes: Record<Position, HeroLane> = {
  top: "TOP",
  mid: "MID",
  rung: "JUNGLE",
  "rong-ad": "DRAGON",
  "tro-thu": "SUPPORT",
}
