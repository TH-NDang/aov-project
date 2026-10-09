import { isRouteErrorResponse, Link, useRouteError } from "react-router"
import { TriangleAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Spinner } from "@aov/ui/components/spinner"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aov/ui/components/empty"
import { errorMessage } from "@/lib/api/errors"

export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : errorMessage(error)
  return (
    <Empty className="m-6 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlert />
        </EmptyMedia>
        <EmptyTitle>Trang gặp lỗi</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Tải lại trang
        </Button>
        <Button asChild>
          <Link to="/">Về bảng điều khiển</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}

/** Shown while the first lazily loaded route resolves. */
export function AppLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <Spinner /> Đang tải AOV Admin…
    </div>
  )
}
