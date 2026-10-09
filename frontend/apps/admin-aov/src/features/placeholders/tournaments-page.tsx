import { Trophy } from "lucide-react"
import { ComingSoon } from "./coming-soon"

export function TournamentsPage() {
  return (
    <ComingSoon
      icon={Trophy}
      title="Giải đấu"
      description="Quản lý giải, đội, lịch thi đấu, kết quả và cấm/chọn tướng."
      service="community-service · module tournament"
      modules={[
        {
          title: "Giải đấu",
          items: [
            "Tạo giải, mùa, thể thức",
            "Gắn region và patch áp dụng",
            "Trạng thái: sắp diễn ra, đang diễn ra, kết thúc",
          ],
        },
        {
          title: "Đội & tuyển thủ",
          items: ["Hồ sơ đội, logo", "Danh sách tuyển thủ theo mùa", "Lịch sử chuyển nhượng"],
        },
        {
          title: "Trận đấu",
          items: ["Lịch thi đấu, nhánh đấu", "Kết quả từng ván", "Cấm/chọn tướng theo heroId của wiki"],
        },
      ]}
    />
  )
}
