import type { Relation } from "./import-relations"

/** What the import screen calls each hero field the server lists; the server sends only the key and the type. */
const FIELD_LABELS: Record<string, string> = {
  name: "Tên tướng",
  title: "Danh hiệu",
  summary: "Giới thiệu",
  lore: "Cốt truyện",
  roles: "Vai trò (mảng JSON)",
  overviewRatings: "Đánh giá tổng quan (JSON)",
  combatStats: "Chỉ số chiến đấu (JSON)",
  skills: "Kỹ năng (mảng JSON)",
  skins: "Trang phục (mảng JSON)",
  images: "Các lựa chọn ảnh tướng (JSON)",
  head: "Ảnh đại diện",
  portrait: "Ảnh chân dung",
  splash: "Ảnh nền",
}

/** What the import screen calls each field of a skill or a skin row. */
const RELATION_FIELD_LABELS: Record<Relation, Record<string, string>> = {
  skills: {
    skillKey: "Mã kỹ năng",
    kind: "Loại kỹ năng",
    formKey: "Mã dạng tướng",
    displayOrder: "Thứ tự",
    name: "Tên kỹ năng",
    description: "Mô tả kỹ năng",
    effects: "Hiệu ứng",
    iconAssetId: "Ảnh icon kỹ năng",
  },
  skins: {
    skinKey: "Mã trang phục",
    displayOrder: "Thứ tự",
    rarityCode: "Mã bậc",
    name: "Tên trang phục",
    description: "Mô tả",
    acquisitionNote: "Cách sở hữu",
    artAssetId: "Ảnh nền trang phục",
    headAssetId: "Ảnh head trang phục",
    portraitAssetId: "Ảnh portrait trang phục",
    images: "Các lựa chọn ảnh (JSON)",
  },
}

/** A field the server lists before this table knows it shows its key, so it can still be mapped. */
export const importFieldLabel = (key: string) => FIELD_LABELS[key] ?? key

export const relationFieldLabel = (section: Relation, key: string) => RELATION_FIELD_LABELS[section][key] ?? key
