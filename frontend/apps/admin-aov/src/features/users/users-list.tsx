import { Link } from "react-router"
import { ChevronRight, Clock3, Globe2, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@aov/ui/components/avatar"
import { Skeleton } from "@aov/ui/components/skeleton"
import type { UserProfile } from "./user-api"

const columns = "sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_7.5rem]"
const languages = new Intl.DisplayNames(["vi"], { type: "language" })
const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" })

function languageName(locale: string) {
  try {
    return languages.of(locale) ?? locale
  } catch {
    return locale
  }
}

function UpdatedAt({ value }: { value: string | null }) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return <span className="text-muted-foreground">Chưa có thông tin</span>
  return (
    <time dateTime={value ?? undefined} className="flex gap-2 tabular-nums sm:flex-col sm:gap-1">
      <span className="font-medium">{dateFormat.format(date)}</span>
      <span className="text-muted-foreground">{timeFormat.format(date)}</span>
    </time>
  )
}

function ListHeading() {
  return (
    <div
      aria-hidden
      className={`hidden gap-5 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid ${columns}`}
    >
      <span className="pl-2">Người dùng</span>
      <span>Ngôn ngữ & múi giờ</span>
      <span>Cập nhật gần nhất</span>
    </div>
  )
}

export function UsersList({ profiles }: { profiles: UserProfile[] }) {
  return (
    <>
      <ListHeading />
      <ul aria-label="Hồ sơ người dùng" className="divide-y">
        {profiles.map((profile) => (
          <li key={profile.id} className={`grid items-center gap-3 px-4 py-3 sm:gap-5 ${columns}`}>
            <Link
              to={`/users/${profile.id}`}
              aria-label={`Xem hồ sơ ${profile.displayName}`}
              className="group flex min-w-0 items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <Avatar className="size-10 border border-border/60">
                <AvatarImage
                  src={profile.avatarUrl ?? undefined}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="object-cover"
                />
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {profile.displayName.slice(0, 2).toUpperCase() || <UserRound aria-hidden className="size-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold underline-offset-4 group-hover:underline group-focus-visible:underline">
                  {profile.displayName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Xem hồ sơ</p>
              </div>
              <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
              />
            </Link>
            <dl className="min-w-0 space-y-1.5 max-sm:px-2">
              <div className="flex items-start gap-2 text-xs">
                <dt className="shrink-0 text-muted-foreground">
                  <Globe2 aria-hidden className="size-3.5" />
                  <span className="sr-only">Ngôn ngữ</span>
                </dt>
                <dd className="min-w-0 break-words font-medium">{languageName(profile.locale)}</dd>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <dt className="shrink-0">
                  <Clock3 aria-hidden className="size-3.5" />
                  <span className="sr-only">Múi giờ</span>
                </dt>
                <dd className="min-w-0 break-words">{profile.timeZone.replaceAll("_", " ")}</dd>
              </div>
            </dl>
            <dl className="text-xs max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-3 max-sm:border-t max-sm:px-2 max-sm:pt-3">
              <dt className="text-muted-foreground sm:sr-only">Cập nhật gần nhất</dt>
              <dd>
                <UpdatedAt value={profile.updatedAt} />
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}

export function UsersListSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Đang tải danh sách người dùng…</span>
      <ListHeading />
      <div aria-hidden className="divide-y">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className={`grid gap-4 px-4 py-5 sm:gap-5 ${columns}`}>
            <div className="flex items-center gap-3 px-2">
              <Skeleton className="size-10 shrink-0 rounded-full motion-reduce:animate-none" />
              <div className="w-full space-y-2">
                <Skeleton className="h-3.5 w-3/4 motion-reduce:animate-none" />
                <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
              </div>
            </div>
            <div className="space-y-2 max-sm:px-2">
              <Skeleton className="h-3.5 w-3/4 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-full motion-reduce:animate-none" />
            </div>
            <Skeleton className="h-3.5 w-20 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  )
}
