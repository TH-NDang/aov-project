import { Gem } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aov/ui/components/empty"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Page, PageHeader } from "@/components/page-header"
import { useArcanaStatus } from "@/lib/queries"

export function ArcanaPage() {
  const arcana = useArcanaStatus()
  return (
    <Page>
      <PageHeader
        title="Bảng ngọc"
        description="Ngọc bổ trợ và bảng ngọc gợi ý theo tướng."
        actions={arcana.data && <Badge variant="outline">Trạng thái: {arcana.data.status}</Badge>}
      />
      {arcana.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gem />
            </EmptyMedia>
            <EmptyTitle>Chưa thu thập bộ ngọc</EmptyTitle>
            <EmptyDescription>
              {arcana.data?.note ?? "Chưa có dữ liệu."} Khi có file data/ngoc.json đầy đủ, trang này sẽ hiển thị danh
              sách ngọc theo màu và cấp.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </Page>
  )
}
