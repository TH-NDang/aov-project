import { Radio } from "lucide-react"
import { ComingSoon } from "./coming-soon"

export function StreamsPage() {
  return (
    <ComingSoon
      icon={Radio}
      title="Livestream"
      description="Danh sách kênh, trạng thái đang phát trực tiếp và trình phát nhúng của từng nền tảng."
      service="community-service · module livestream"
      modules={[
        {
          title: "Kênh",
          items: [
            "Thêm kênh YouTube, Twitch, Facebook Gaming",
            "Gắn kênh với đội hoặc giải đấu",
            "Ẩn/hiện kênh trên trang stream",
          ],
        },
        {
          title: "Trạng thái phát trực tiếp",
          items: ["Đồng bộ trạng thái theo lịch", "Lịch phát sóng sắp tới", "Không tự host video, chỉ nhúng player"],
        },
        { title: "Kiểm duyệt", items: ["Báo cáo nội dung", "Danh sách chặn", "Nhật ký thao tác quản trị"] },
      ]}
    />
  )
}
