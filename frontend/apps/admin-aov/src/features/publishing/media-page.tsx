import { useState } from "react"
import { Page, PageHeader } from "@/components/page-header"
import { AssetPicker } from "./asset-picker"
import { control } from "./fields"
export function PublishedMediaPage() {
  const [semanticType, setSemanticType] = useState("HERO_HEAD")
  const [assetId, setAssetId] = useState<string | null>(null)
  return (
    <Page>
      <PageHeader
        title="Media backend"
        description="Quản lý ảnh trong kho backend. Nâng chất lượng cùng artwork giữ nguyên HeroRevision; artwork khác cần asset mới."
      />
      <label className="grid max-w-md gap-2 text-sm">
        Loại ảnh
        <select
          className={control}
          value={semanticType}
          onChange={(e) => {
            setSemanticType(e.target.value)
            setAssetId(null)
          }}
        >
          {["HERO_HEAD", "HERO_PORTRAIT", "HERO_SPLASH", "HERO_SKILL_ICON", "HERO_SKIN_ART"].map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <AssetPicker key={semanticType} semanticType={semanticType} value={assetId} onChange={setAssetId} />
    </Page>
  )
}
