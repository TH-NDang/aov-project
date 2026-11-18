import type { Lane } from "@aov/community-contracts"

/** The one table of lane names: a player's lane in a match, and a hero's lanes in the catalog. */
export const LANE_LABELS: Record<Lane, { name: string; short: string }> = {
  TOP: { name: "Đường Caesar", short: "Caesar" },
  JUNGLE: { name: "Đi rừng", short: "Rừng" },
  MID: { name: "Đường giữa", short: "Giữa" },
  DRAGON: { name: "Đường Rồng", short: "Rồng" },
  SUPPORT: { name: "Trợ thủ", short: "Trợ thủ" },
}
export const LANE_ORDER: Lane[] = ["TOP", "JUNGLE", "MID", "DRAGON", "SUPPORT"]
