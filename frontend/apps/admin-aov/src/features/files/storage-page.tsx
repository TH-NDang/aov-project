import { AlertTriangle, CheckCircle2, CircleAlert, CloudOff, RefreshCw } from "lucide-react"
import { Link } from "react-router"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aov/ui/components/card"
import { LocalMoney } from "@aov/ui/components/local-money"
import { LocalTime } from "@aov/ui/components/local-time"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Page, PageHeader } from "@/components/page-header"
import { FileTabs } from "./file-tabs"
import { useStorageSummary, type CapacityLevel, type StorageBucket, type StorageSummary } from "./files-api"
import {
  BUCKET_HINTS,
  BUCKET_LABELS,
  formatCount,
  formatMonth,
  formatShare,
  formatStorage,
  groupLabel,
  LEVEL_COLORS,
  LEVEL_LABELS,
} from "./files-format"

/** How much of the R2 free tier the project uses, from the database or from Cloudflare (ADR-030 section 9). */
export function StoragePage() {
  const summary = useStorageSummary()
  return (
    <Page>
      <PageHeader
        title="Quản lý tệp"
        actions={
          <Button variant="outline" disabled={summary.isFetching} onClick={() => void summary.refetch()}>
            <RefreshCw aria-hidden className={summary.isFetching ? "motion-safe:animate-spin" : undefined} />
            Làm mới số liệu
          </Button>
        }
      >
        <FileTabs current="storage" />
      </PageHeader>
      {summary.isLoadingError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 p-3">
          <p className="type-body text-destructive">Không đọc được số liệu dung lượng.</p>
          <Button variant="outline" size="sm" onClick={() => void summary.refetch()}>
            Thử tải lại
          </Button>
        </div>
      ) : !summary.data ? (
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <StorageReport summary={summary.data} />
      )}
    </Page>
  )
}

function StorageReport({ summary }: { summary: StorageSummary }) {
  const { storage, operations, freeTier, prices } = summary
  const gigabytes = summary.bytesPerGigabyte
  // Overage is billed in whole units, but a running estimate reads better unrounded; both are zero inside the tier.
  const storageCost =
    (Math.max(0, storage.bytes - freeTier.storageBytes) / gigabytes) * prices.storageUsdPerGigabyteMonth
  const operationCost =
    (Math.max(0, operations.classA - freeTier.classAOperations) / 1_000_000) * prices.classAUsdPerMillion +
    (Math.max(0, operations.classB - freeTier.classBOperations) / 1_000_000) * prices.classBUsdPerMillion
  const worst = [storage.level, operations.classALevel, operations.classBLevel].reduce(worse)

  return (
    <div className="grid gap-4">
      {worst !== "OK" && <LevelBanner level={worst} />}
      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="admin-section xl:col-span-3">
          <CardHeader>
            <CardTitle>Dung lượng đã dùng</CardTitle>
            <CardDescription>
              {storage.source === "CLOUDFLARE"
                ? "Theo số liệu Cloudflare của ba bucket, gồm cả bytes chưa có trong danh mục."
                : summary.cloudflare.state === "OK"
                  ? "Theo danh mục trong database. Cloudflare chỉ cập nhật dung lượng theo chu kỳ, nên chưa tính lượt tải gần đây."
                  : "Theo danh mục trong database: ảnh công khai, tệp nguồn và upload đang chờ."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="type-page-title tabular-nums">{formatStorage(storage.bytes)}</span>
              <span className="type-body text-muted-foreground">
                / {formatStorage(freeTier.storageBytes)} miễn phí mỗi tháng
              </span>
            </p>
            <Meter share={storage.share} level={storage.level} label="Dung lượng so với mức miễn phí" />
            <LevelLine level={storage.level} share={storage.share} />
          </CardContent>
        </Card>
        <Card className="admin-section xl:col-span-2">
          <CardHeader>
            <CardTitle>Chi phí dự kiến</CardTitle>
            <CardDescription>{formatMonth(operations.month)}, phần vượt mức miễn phí.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="type-page-title tabular-nums">
              <LocalMoney amounts={[{ amount: storageCost + operationCost, currency: "USD" }]} />
            </p>
            <p className="type-meta">
              Vượt mức tính <LocalMoney amounts={[{ amount: prices.storageUsdPerGigabyteMonth, currency: "USD" }]} />{" "}
              mỗi GB-tháng, <LocalMoney amounts={[{ amount: prices.classAUsdPerMillion, currency: "USD" }]} /> mỗi triệu
              thao tác lớp A, <LocalMoney amounts={[{ amount: prices.classBUsdPerMillion, currency: "USD" }]} /> mỗi
              triệu lớp B. Tải về qua R2 và CDN không tính phí.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="admin-section">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Thao tác {formatMonth(operations.month).toLowerCase()}
            {operations.source === "ESTIMATE" && <Badge variant="outline">Ước lượng</Badge>}
          </CardTitle>
          <CardDescription>
            {operations.source === "ESTIMATE"
              ? "Tính từ số tệp đã tải trong tháng: mỗi tệp 2 thao tác lớp A (tải lên, sao chép) và 2 lớp B (đọc để kiểm tra). Lượt xem ảnh qua CDN không có ở đây."
              : "Số thật của Cloudflare từ đầu tháng (giờ UTC), gồm cả lượt CDN đọc R2 và lượt xem ảnh đối chứng."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <OperationMeter
            label="Lớp A: ghi, sao chép, liệt kê"
            used={operations.classA}
            free={freeTier.classAOperations}
            share={operations.classAShare}
            level={operations.classALevel}
          />
          <OperationMeter
            label="Lớp B: đọc, kiểm tra"
            used={operations.classB}
            free={freeTier.classBOperations}
            share={operations.classBShare}
            level={operations.classBLevel}
          />
        </CardContent>
      </Card>

      <Card className="admin-section">
        <CardHeader>
          <CardTitle>Theo bucket</CardTitle>
          <CardDescription>
            Mỗi thanh là phần của bucket trong {formatStorage(freeTier.storageBytes)} miễn phí.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {summary.buckets.map((bucket) => (
            <BucketRow key={bucket.role} bucket={bucket} freeBytes={freeTier.storageBytes} summary={summary} />
          ))}
        </CardContent>
      </Card>

      <Card className="admin-section">
        <CardHeader>
          <CardTitle>Tải lên theo tháng</CardTitle>
          <CardDescription>Ảnh Media và tệp nguồn được lưu trong tháng, kể cả ảnh sau đó đã xóa.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthTable months={summary.months} />
        </CardContent>
      </Card>

      <CloudflareCard summary={summary} />
    </div>
  )
}

const ORDER: CapacityLevel[] = ["OK", "WARNING", "CRITICAL", "OVER"]

function worse(left: CapacityLevel, right: CapacityLevel) {
  return ORDER.indexOf(right) > ORDER.indexOf(left) ? right : left
}

/** A ratio against a limit: the fill carries the state, the track is a lighter step of the same color. */
function Meter({
  share,
  level,
  label,
  thin = false,
}: {
  share: number
  level: CapacityLevel
  label: string
  thin?: boolean
}) {
  const colors = LEVEL_COLORS[level]
  const percent = Math.min(100, Math.max(0, share * 100))
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(share * 100)}
      aria-valuetext={formatShare(share)}
      className={thin ? "h-1.5 overflow-hidden rounded-full" : "h-2 overflow-hidden rounded-full"}
      style={{ background: colors.track }}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${percent}%`, minWidth: share > 0 ? 4 : 0, background: colors.fill }}
      />
    </div>
  )
}

function LevelIcon({ level }: { level: CapacityLevel }) {
  const Icon = level === "OK" ? CheckCircle2 : level === "WARNING" ? CircleAlert : AlertTriangle
  return <Icon aria-hidden className="size-4 shrink-0" style={{ color: LEVEL_COLORS[level].ink }} />
}

function LevelLine({ level, share }: { level: CapacityLevel; share: number }) {
  return (
    <p className="flex items-center gap-1.5 type-meta">
      <LevelIcon level={level} />
      <span>
        {formatShare(share)} mức miễn phí · {LEVEL_LABELS[level]}
      </span>
    </p>
  )
}

function LevelBanner({ level }: { level: CapacityLevel }) {
  const colors = LEVEL_COLORS[level]
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border p-3"
      style={{ background: colors.track, borderColor: colors.fill }}
    >
      <LevelIcon level={level} />
      <p className="type-body">
        <strong>{LEVEL_LABELS[level]}.</strong>{" "}
        {level === "OVER"
          ? "Phần vượt đang được tính phí. Xem bucket nào lớn nhất bên dưới và dọn bytes mồ côi trước khi tải thêm."
          : "Kiểm tra ước lượng trước mỗi đợt tải lên; dọn bytes mồ côi ở phần Tệp nguồn nếu cần chỗ."}
      </p>
    </div>
  )
}

function OperationMeter(props: { label: string; used: number; free: number; share: number; level: CapacityLevel }) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="type-label">{props.label}</span>
        <span className="type-body tabular-nums">
          {formatCount(props.used)} / {formatCount(props.free)}
        </span>
      </div>
      <Meter share={props.share} level={props.level} label={props.label} />
      <LevelLine level={props.level} share={props.share} />
    </div>
  )
}

function BucketRow({
  bucket,
  freeBytes,
  summary,
}: {
  bucket: StorageBucket
  freeBytes: number
  summary: StorageSummary
}) {
  const share = bucket.bytes / freeBytes
  const measured = summary.cloudflare.buckets?.find((item) => item.bucket === bucket.bucket)
  const largest = Math.max(1, ...bucket.groups.map((group) => group.bytes))
  return (
    <section aria-label={BUCKET_LABELS[bucket.role]} className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="type-label">{BUCKET_LABELS[bucket.role]}</h3>
          <p className="type-meta">
            <code>{bucket.bucket}</code> · {BUCKET_HINTS[bucket.role]}
          </p>
        </div>
        <p className="type-body tabular-nums">
          {formatStorage(bucket.bytes)} · {formatCount(bucket.files)} tệp
        </p>
      </div>
      <Meter share={share} level="OK" label={`${BUCKET_LABELS[bucket.role]} so với mức miễn phí`} thin />
      {measured && (
        <p className="type-meta">
          Cloudflare đo {formatStorage(measured.bytes)} · {formatCount(measured.objects)} object
          {measured.pendingUploads > 0 && ` · ${formatCount(measured.pendingUploads)} upload nhiều phần dở dang`}
        </p>
      )}
      {bucket.role === "SOURCES" && (bucket.orphanFiles ?? 0) > 0 && (
        <p className="type-meta">
          Trong đó {formatCount(bucket.orphanFiles ?? 0)} tệp mồ côi, {formatStorage(bucket.orphanBytes ?? 0)}.{" "}
          <Link className="underline underline-offset-2" to="/image-management?tab=sources&orphans=1">
            Xem và dọn
          </Link>
        </p>
      )}
      {bucket.groups.length > 0 && (
        <ul className="grid gap-1.5 border-l pl-3" aria-label={`${BUCKET_LABELS[bucket.role]} theo loại`}>
          {bucket.groups.map((group) => (
            <li
              key={group.key}
              className="grid gap-1 sm:grid-cols-[minmax(10rem,14rem)_1fr_auto] sm:items-center sm:gap-3"
            >
              <span className="type-body">{groupLabel(bucket.role, group.key)}</span>
              <span className="h-1 overflow-hidden rounded-full bg-[var(--aov-raised)]" aria-hidden>
                <span
                  className="block h-full rounded-full bg-[var(--aov-chart)]"
                  style={{ width: `${(group.bytes / largest) * 100}%`, minWidth: group.bytes > 0 ? 4 : 0 }}
                />
              </span>
              <span className="type-meta tabular-nums sm:text-right">
                {formatStorage(group.bytes)} · {formatCount(group.files)} tệp
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MonthTable({ months }: { months: StorageSummary["months"] }) {
  const largest = Math.max(1, ...months.map((month) => month.bytes))
  // Months before the first upload say nothing; the current month always stays, even when empty.
  const first = months.findIndex((month) => month.files > 0)
  const rows = months.slice(first < 0 ? months.length - 1 : first).reverse()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse">
        <caption className="sr-only">Tải lên theo tháng, mới nhất trước</caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="py-2 pr-3 type-label">
              Tháng
            </th>
            <th scope="col" className="py-2 pr-3 text-right type-label">
              Tệp
            </th>
            <th scope="col" className="w-2/5 py-2 pr-3 type-label">
              Dung lượng
            </th>
            <th scope="col" className="py-2 pr-3 text-right type-label">
              Lớp A
            </th>
            <th scope="col" className="py-2 text-right type-label">
              Lớp B
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((month) => (
            <tr key={month.month} className="border-b last:border-b-0">
              <th scope="row" className="py-2 pr-3 text-left type-body">
                {formatMonth(month.month)}
              </th>
              <td className="py-2 pr-3 text-right type-body tabular-nums">{formatCount(month.files)}</td>
              <td className="py-2 pr-3">
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--aov-raised)]" aria-hidden>
                    <span
                      className="block h-full rounded-full bg-[var(--aov-chart)]"
                      style={{ width: `${(month.bytes / largest) * 100}%`, minWidth: month.bytes > 0 ? 4 : 0 }}
                    />
                  </span>
                  <span className="w-20 text-right type-body tabular-nums">{formatStorage(month.bytes)}</span>
                </span>
              </td>
              <td className="py-2 pr-3 text-right type-body tabular-nums">{formatCount(month.classA)}</td>
              <td className="py-2 text-right type-body tabular-nums">{formatCount(month.classB)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CloudflareCard({ summary }: { summary: StorageSummary }) {
  const { cloudflare } = summary
  if (cloudflare.state === "OK")
    return (
      <p className="flex items-center gap-1.5 type-meta">
        <CheckCircle2 aria-hidden className="size-4 text-[var(--aov-success)]" />
        Số liệu Cloudflare cập nhật {cloudflare.checkedAt ? <LocalTime value={cloudflare.checkedAt} /> : "gần đây"}, làm
        mới mỗi 15 phút.
      </p>
    )
  return (
    <Card className="admin-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudOff aria-hidden className="size-4" />
          {cloudflare.state === "UNAVAILABLE" ? "Không đọc được số liệu Cloudflare" : "Chưa bật số liệu Cloudflare"}
        </CardTitle>
        <CardDescription>
          {cloudflare.state === "UNAVAILABLE"
            ? "Cloudflare không trả lời lần gần nhất; trang đang dùng số liệu database và sẽ thử lại sau một phút."
            : "Database đã cho dung lượng theo loại và theo tháng. Số thật của Cloudflare thêm số thao tác thật và phần tệp không có trong danh mục, như upload bỏ dở."}
        </CardDescription>
      </CardHeader>
      {cloudflare.state === "NOT_CONFIGURED" && (
        <CardContent>
          <ol className="grid list-decimal gap-1 pl-5 type-body">
            <li>Trong Cloudflare, tạo API token chỉ có quyền Account Analytics: Read.</li>
            <li>
              Thêm <code>CLOUDFLARE_ACCOUNT_ID</code> và <code>CLOUDFLARE_ANALYTICS_TOKEN</code> vào tệp môi trường
              riêng của backend (<code>.env.r2</code>), rồi khởi động lại backend.
            </li>
          </ol>
        </CardContent>
      )}
    </Card>
  )
}
