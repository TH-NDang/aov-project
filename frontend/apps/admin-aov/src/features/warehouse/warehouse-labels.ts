const fieldLabels: Record<string, string> = {
  iconAssetId: "Biểu tượng",
  translations: "Bản dịch",
  name: "Tên hiển thị",
  description: "Mô tả",
  summary: "Tóm tắt",
  tier: "Cấp",
  color: "Màu ngọc",
  stats: "Chỉ số",
  price: "Giá vàng",
  categoryCode: "Nhóm trang bị",
  recipeStatus: "Xác minh công thức",
  components: "Thành phần ghép",
  branchCode: "Hệ phù hiệu",
  position: "Thứ tự trong cấp",
  cooldownSeconds: "Hồi chiêu",
  availability: "Khả dụng",
  unlockType: "Điều kiện mở khóa",
  unlockLevel: "Cấp mở khóa",
  effectiveFromPatchVariantId: "Patch ghi nhận dữ liệu",
  "revision.effectiveFromPatchVariantId": "Patch ghi nhận dữ liệu",
}

export function warehouseMissingFieldLabel(path: string): string {
  const translation = /^translations\.([^.]+)\.(.+)$/.exec(path)
  if (translation) return `${fieldLabels[translation[2]] ?? translation[2]} · ${translation[1]}`
  return fieldLabels[path] ?? path
}
