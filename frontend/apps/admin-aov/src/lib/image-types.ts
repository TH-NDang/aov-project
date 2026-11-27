/**
 * Names of the Media image types (MediaSemanticType), one per type for every Admin screen: the image list and its
 * filter, the image sheet and the storage report. A type the table does not know is shown by its code.
 */
export const IMAGE_TYPE_LABELS: Record<string, string> = {
  USER_AVATAR: "Ảnh đại diện người dùng",
  HERO_HEAD: "Đại diện tướng",
  HERO_PORTRAIT: "Chân dung tướng",
  HERO_SPLASH: "Ảnh nền tướng",
  HERO_SKILL_ICON: "Biểu tượng kỹ năng",
  HERO_SKIN_ART: "Ảnh trang phục",
  SKIN_BADGE: "Biểu tượng bậc / nhãn trang phục",
  ITEM_ICON: "Biểu tượng trang bị",
  ARCANA_ICON: "Biểu tượng ngọc",
  SPELL_ICON: "Biểu tượng phụ trợ",
  ENCHANTMENT_ICON: "Biểu tượng phù hiệu",
  PATCH_ART: "Ảnh bản cập nhật",
  CHIBI_STICKER: "Sticker chibi",
  GAME_MODE_ART: "Ảnh chế độ chơi",
  AUTO_CHESS_ICON: "Biểu tượng Cờ Liên Quân",
  MAP_ICON: "Biểu tượng bản đồ",
  OTHER: "Ảnh khác",
}

export const imageTypeLabel = (type: string) => IMAGE_TYPE_LABELS[type] ?? type

/** Image files the Media upload accepts, and its size limit; every upload in the Admin checks the same two rules. */
export const UPLOAD_IMAGE_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"]
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024

export const isUploadableImage = (file: Pick<File, "type" | "size">) =>
  UPLOAD_IMAGE_TYPES.includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES
