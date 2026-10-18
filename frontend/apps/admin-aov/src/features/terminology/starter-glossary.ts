import type { EntityReference } from "@aov/ui/lib/entity-rich-text"

const entries: [string, string, string[], string][] = [
  [
    "sat-thuong-vat-ly",
    "Sát thương vật lý",
    ["ST vật lý"],
    "Loại sát thương chịu ảnh hưởng bởi giáp và xuyên giáp của các bên.",
  ],
  [
    "sat-thuong-phep",
    "Sát thương phép",
    ["ST phép"],
    "Loại sát thương chịu ảnh hưởng bởi giáp phép và xuyên giáp phép.",
  ],
  ["sat-thuong-chuan", "Sát thương chuẩn", ["ST chuẩn"], "Loại sát thương bỏ qua giáp và giáp phép."],
  [
    "cong-vat-ly",
    "Công vật lý",
    ["Công VL"],
    "Chỉ số được dùng trong tính sát thương của đòn đánh và các chiêu thức vật lý.",
  ],
  [
    "cong-phep",
    "Công phép",
    [],
    "Chỉ số được dùng trong tính sát thương hoặc hiệu ứng của các chiêu thức có hệ số công phép.",
  ],
  ["giap", "Giáp", ["Giáp vật lý"], "Chỉ số giúp giảm sát thương vật lý phải nhận."],
  ["giap-phep", "Giáp phép", ["Kháng phép"], "Chỉ số giúp giảm sát thương phép phải nhận."],
  ["hoi-mau", "Hồi máu", ["Hồi phục máu"], "Khôi phục một lượng máu cho tướng."],
  ["la-chan", "Lá chắn", [], "Hiệu ứng giúp hấp thụ sát thương trong phạm vi và thời gian do chiêu thức quy định."],
  ["toc-chay", "Tốc chạy", ["Tốc độ di chuyển"], "Chỉ số thể hiện tốc độ di chuyển của tướng."],
  [
    "toc-danh",
    "Tốc đánh",
    ["Tốc độ đánh"],
    "Chỉ số liên quan đến số đòn đánh thường tướng có thể thực hiện trong một khoảng thời gian.",
  ],
  ["chi-mang", "Chí mạng", [], "Đòn đánh gây thêm sát thương so với đòn đánh thông thường, theo quy tắc của hiệu ứng."],
  ["lam-cham", "Làm chậm", [], "Hiệu ứng giảm tốc chạy của mục tiêu trong một khoảng thời gian."],
  [
    "choang",
    "Choáng",
    ["Làm choáng"],
    "Hiệu ứng khống chế khiến mục tiêu tạm thời không thể di chuyển, đánh thường hoặc dùng chiêu.",
  ],
  [
    "giam-hoi-chieu",
    "Giảm hồi chiêu",
    ["Giảm thời gian hồi chiêu"],
    "Chỉ số giúp rút ngắn thời gian chờ giữa các lần sử dụng chiêu thức.",
  ],
  ["noi-tai", "Nội tại", [], "Hiệu ứng bị động tự kích hoạt khi đáp ứng các điều kiện được mô tả."],
]

export const starterGlossary: EntityReference[] = entries.map(([id, name, aliases, description]) => ({
  id,
  kind: "term",
  translations: [{ locale: "vi-VN", name, aliases, description }],
  display: { underline: true, showIcon: false },
}))
