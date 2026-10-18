import type { ImageOption, MediaRole } from "./types"

/** Keep former and replacement primary images available in the same owner/role gallery. */
export function retainImageOptions(
  images: Partial<Record<MediaRole, ImageOption[]>> | undefined,
  role: MediaRole,
  ...assetIds: (string | null | undefined)[]
) {
  const options = [...(images?.[role] ?? [])]
  for (const assetId of assetIds)
    if (assetId && !options.some((option) => option.assetId === assetId)) options.push({ assetId, label: null })
  return { ...images, [role]: options }
}
