import type { LucideIcon } from "lucide-react"
import { CheckCircle2 } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aov/ui/components/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aov/ui/components/empty"
import { Page, PageHeader } from "@/components/page-header"

interface ComingSoonProps {
  icon: LucideIcon
  title: string
  description: string
  service: string
  modules: { title: string; items: string[] }[]
}

/** Planned area of the admin app whose backend (community-service) does not exist yet. */
export function ComingSoon({ icon: Icon, title, description, service, modules }: ComingSoonProps) {
  return (
    <Page>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {title} <Badge variant="secondary">Sắp có</Badge>
          </span>
        }
        description={description}
      />
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>Chưa có dữ liệu</EmptyTitle>
          <EmptyDescription>
            Khu vực này dùng <code className="font-mono text-foreground">{service}</code>, sẽ được triển khai sau AOV
            Wiki. Bố cục bên dưới là phạm vi dự kiến.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <Card key={module.title}>
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
              <CardDescription>Phạm vi dự kiến</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {module.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </Page>
  )
}
