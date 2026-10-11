import { Zap } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aov/ui/components/empty"
import { Page, PageHeader } from "@/components/page-header"

export function SpellsPage() {
  return (
    <Page>
      <PageHeader title="Phụ trợ" description="Danh mục phép phụ trợ cho tướng." />
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Zap />
          </EmptyMedia>
          <EmptyTitle>Chưa có dữ liệu phụ trợ</EmptyTitle>
          <EmptyDescription>Danh sách phụ trợ sẽ hiển thị tại đây khi có dữ liệu.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </Page>
  )
}
