import type { WarehouseMetadata } from "./warehouse-types"

const branchColors: Record<string, string> = {
  "thap-quang-minh": "#d6ad57",
  "vuc-hon-mang": "#e85c64",
  "rung-nguyen-sinh": "#65b979",
  "thanh-khoi-nguyen": "#59a6e8",
}

export function enchantmentBranchColor(branch: Pick<WarehouseMetadata, "code" | "color">): string {
  return branch.color?.trim() || branchColors[branch.code] || "#d6ad57"
}
