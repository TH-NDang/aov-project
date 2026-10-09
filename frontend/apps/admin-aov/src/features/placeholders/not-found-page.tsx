import { Link } from "react-router"
import { FileQuestion } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aov/ui/components/empty"

export function NotFoundPage() {
  return (
    <Empty className="m-6 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>Không tìm thấy trang</EmptyTitle>
        <EmptyDescription>Đường dẫn không tồn tại hoặc đã được đổi.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/">Về bảng điều khiển</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
