import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronDown, Globe2, LoaderCircle, LockKeyhole } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { backendRequest } from "@/app/auth/session"

interface Region {
  code: string
  displayName: string
  productName: string
  available: boolean
  unavailableReason: string | null
}

export function RegionSelector() {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState("")
  const regions = useQuery({
    queryKey: ["regions"],
    queryFn: ({ signal }) => backendRequest<Region[]>("/regions", { signal }),
    enabled: open,
    staleTime: 0,
    retry: 1,
  })

  async function selectVietnam() {
    setSelecting(true)
    setError("")
    try {
      await backendRequest<Region>("/regions/VN")
      setOpen(false)
    } catch {
      setError("Chưa thể xác nhận thị trường. Vui lòng thử lại.")
      void regions.refetch()
    } finally {
      setSelecting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" aria-label="Thị trường dữ liệu: Việt Nam">
          <Globe2 className="size-4" />
          <span className="hidden sm:inline">Việt Nam</span>
          <span className="sm:hidden">VN</span>
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1rem)] p-2">
        <div className="px-2 py-2">
          <h2 className="type-section-title">Thị trường dữ liệu</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Dữ liệu hiện tại dành cho Việt Nam. Các thị trường khác sẽ được mở khi sẵn sàng.
          </p>
        </div>
        {regions.isPending ? (
          <p role="status" className="flex items-center gap-2 p-3 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Đang tải thị trường…
          </p>
        ) : regions.isError ? (
          <div role="alert" className="space-y-2 p-2 text-sm">
            <p>Không tải được danh mục thị trường. Vui lòng kiểm tra backend đã cập nhật.</p>
            <Button size="sm" variant="outline" onClick={() => void regions.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <ul className="space-y-1" aria-label="Các thị trường">
            {regions.data.map((region) => {
              // The current admin data adapter only supports VN, even if another backend market is enabled.
              const disabled = !region.available || region.code !== "VN"
              return (
                <li key={region.code}>
                  <button
                    type="button"
                    disabled={disabled || selecting}
                    onClick={() => void selectVietnam()}
                    aria-label={region.displayName + (disabled ? ": Chưa hỗ trợ" : ": Đang dùng")}
                    className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                      {region.code === "GLOBAL" ? <Globe2 className="size-4" /> : region.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{region.displayName}</span>
                      <span className="block text-xs text-muted-foreground">{region.productName}</span>
                      {disabled && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Chưa hỗ trợ · {region.unavailableReason || "Admin chưa hỗ trợ dữ liệu thị trường này."}
                        </span>
                      )}
                    </span>
                    {disabled ? (
                      <LockKeyhole className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Check className="mt-1 size-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {error && (
          <p role="alert" className="p-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <p className="border-t px-2 pt-2 pb-1 text-xs text-muted-foreground">
          Thị trường không thay đổi ngôn ngữ hoặc múi giờ hồ sơ.
        </p>
      </PopoverContent>
    </Popover>
  )
}
