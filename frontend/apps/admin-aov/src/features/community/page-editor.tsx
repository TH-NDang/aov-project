import { useEffect, useRef, useState, type ComponentType } from "react"
import { Link, useBeforeUnload, useNavigate, useParams, useBlocker, useSearchParams } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  Check,
  Circle,
  Copy,
  ExternalLink,
  History,
  ImagePlus,
  Info,
  KeyRound,
  LoaderCircle,
  MoreHorizontal,
  Radio,
  Pencil,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Undo2,
  UserRound,
  Users,
} from "lucide-react"
import {
  isIndividualProfile,
  isCommunityProfile,
  personRoleLabels,
  profileKindLabels,
  type CommunityProfile,
} from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Input } from "@aov/ui/components/input"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"
import { cn } from "@aov/ui/lib/utils"
import { Page } from "@/components/page-header"
import { AccessGate, type Access } from "@/features/esports/pages/esports-shell"
import { LocalTime } from "@aov/ui/components/local-time"
import { pageApi, pageError, pageKeys, publicSite } from "./page-api"
import { ProfileFields, Section } from "./profile-fields"
import { profileDirectoryPath } from "./page-directory"
import { OrganizationCompetitions } from "./organization-competitions"
import { PlatformIcon, popularSocialPlatforms, platformOf } from "./platform-icon"
import { ProfileQuickEditSheet, type ProfileQuickEditTarget } from "./profile-quick-edit-sheet"
import { ProfileCountry } from "./profile-country"
import { ProfileTypeIcon } from "./profile-icons"
import { CircuitChannelsField } from "./circuit-channels-field"
import { toast } from "sonner"
import { confirmAction } from "@/components/confirm-dialog"

export function PageEditor() {
  return <AccessGate>{(access) => <EditorLoader access={access} />}</AccessGate>
}
function EditorLoader({ access }: { access: Access }) {
  const { pageId = "" } = useParams()
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState({ pageId: "", tab: "overview" })
  const query = useQuery({
    queryKey: [...pageKeys, access.actorKey, pageId],
    queryFn: () => pageApi.read(pageId),
    refetchOnWindowFocus: false,
  })
  if (!query.data)
    return (
      <Page>
        <p className="type-body" role={query.isError ? "alert" : undefined}>
          {query.isError ? pageError(query.error) : "Đang mở hồ sơ…"}
        </p>
        {query.isError && <Button onClick={() => void query.refetch()}>Thử lại</Button>}
      </Page>
    )
  return (
    <Editor
      key={`${query.data.id}:${query.data.version}`}
      entry={query.data}
      access={access}
      tab={
        section.pageId === pageId
          ? section.tab
          : searchParams.get("tab") === "roster" && query.data.kind === "TEAM"
            ? "roster"
            : "overview"
      }
      setTab={(tab) => setSection({ pageId, tab })}
    />
  )
}
type Icon = ComponentType<{ className?: string }>
type Tab = [string, string, Icon, number | null]
const httpUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)

function Editor({
  entry,
  access,
  tab,
  setTab,
}: {
  entry: CommunityProfile
  access: Access
  tab: string
  setTab: (tab: string) => void
}) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [content, setContent] = useState(entry.content!)
  const [uploading, setUploading] = useState(false)
  const [quickEdit, setQuickEdit] = useState<ProfileQuickEditTarget | null>(null)
  const sectionNavigation = useRef<HTMLElement>(null)
  useEffect(() => {
    const navigation = sectionNavigation.current
    if (!navigation) return
    const revealActiveTab = () => {
      const active = navigation.querySelector<HTMLElement>('[aria-current="page"]')
      if (!active || navigation.scrollWidth <= navigation.clientWidth) return
      const container = navigation.getBoundingClientRect()
      const button = active.getBoundingClientRect()
      const offset =
        button.left < container.left + 8
          ? button.left - container.left - 8
          : button.right > container.right - 8
            ? button.right - container.right + 8
            : 0
      if (offset) navigation.scrollBy({ left: offset, behavior: "instant" })
    }
    revealActiveTab()
    const observer = new ResizeObserver(revealActiveTab)
    observer.observe(navigation)
    return () => observer.disconnect()
  }, [tab])
  const dirty = JSON.stringify(content) !== JSON.stringify(entry.content)
  const community = isCommunityProfile(entry.kind)
  const missingRole = entry.kind === "PERSON" && !content.personRoles?.length
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => (dirty || uploading) && currentLocation.pathname !== nextLocation.pathname,
  )
  useBeforeUnload((event) => {
    if (dirty || uploading) {
      event.preventDefault()
      event.returnValue = ""
    }
  })
  const update = useMutation({
    mutationFn: (publish?: boolean) =>
      publish === undefined ? pageApi.save(entry, content) : pageApi.publish(entry, publish),
    onSuccess: async (_saved, publish) => {
      await client.invalidateQueries({ queryKey: pageKeys })
      toast.success(
        publish === undefined ? "Đã lưu hồ sơ." : publish ? "Đã xuất bản hồ sơ." : "Đã ngừng xuất bản hồ sơ.",
      )
    },
  })
  const remove = useMutation({
    mutationFn: () => pageApi.remove(entry),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: pageKeys })
      void navigate(profileDirectoryPath(entry.kind, content.personRoles))
    },
  })
  const tabs: Tab[] = [
    ["overview", community ? "Thông tin chung" : "Tổng quan", Info, null],
    ...(entry.kind === "TEAM" ? [["roster", "Đội hình & ban huấn luyện", Users, content.roster.length] as Tab] : []),
    [
      "history",
      isIndividualProfile(entry.kind)
        ? "Sự nghiệp & hoạt động"
        : entry.kind === "ORGANIZATION"
          ? "Lịch sử hoạt động"
          : "Lịch sử",
      History,
      content.history.length,
    ],
    ...(entry.kind === "ORGANIZATION" || entry.kind === "CIRCUIT"
      ? [["competitions", entry.kind === "CIRCUIT" ? "Các mùa giải" : "Giải đấu tổ chức", CalendarDays, null] as Tab]
      : entry.kind === "PERSON"
        ? []
        : [["achievements", "Thành tích", Trophy, content.achievements.length] as Tab]),
    ["sources", "Nguồn thông tin", BookOpenText, content.sources.length],
    ...(access.canPublish && community ? [["access", "Quyền đại diện", ShieldCheck, null] as Tab] : []),
  ]
  const completionItems = [
    { done: !!content.name, label: "Tên hiển thị", target: "overview", icon: UserRound },
    { done: !!content.biography, label: "Giới thiệu", target: "overview", icon: Info },
    {
      done: !!content.avatarUrl,
      label: isIndividualProfile(entry.kind) ? "Ảnh chân dung" : "Logo",
      target: "images",
      icon: ImagePlus,
    },
    { done: content.sources.length > 0, label: "Nguồn đối chiếu", target: "sources", icon: BookOpenText },
  ]
  const completed = completionItems.filter((item) => item.done).length
  return (
    <Page className="@container/profile-editor mx-auto w-full max-w-[1400px] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          className="type-body flex w-fit items-center gap-2 text-muted-foreground hover:text-foreground"
          to={profileDirectoryPath(entry.kind, content.personRoles)}
        >
          <ArrowLeft className="size-4" />
          {entry.kind === "PERSON"
            ? content.personRoles?.map((role) => personRoleLabels[role]).join(" · ") || "Nhân sự"
            : profileKindLabels[entry.kind]}
        </Link>
        <span className="type-meta">{community ? "Chỉnh sửa hồ sơ" : "Biên tập hệ thống giải"}</span>
      </div>
      <header className="overflow-hidden rounded-2xl border bg-card">
        <div className="relative h-28 bg-gradient-to-r from-muted via-muted/50 to-muted sm:h-40">
          {httpUrl(content.coverUrl) && (
            <img src={content.coverUrl!} alt={`Ảnh bìa ${content.name}`} className="size-full object-cover" />
          )}
          {access.canWrite && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute bottom-3 right-3 border shadow-sm"
              aria-label="Chỉnh sửa ảnh bìa"
              title="Chỉnh sửa ảnh bìa"
              disabled={uploading || update.isPending}
              onClick={() => setQuickEdit({ type: "image", field: "coverUrl" })}
            >
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-4 px-4 pb-4 @3xl/profile-editor:px-5">
          <div className="relative -mt-10 shrink-0 sm:-mt-12">
            <span className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-muted text-muted-foreground sm:size-24">
              {httpUrl(content.avatarUrl) ? (
                <img
                  src={content.avatarUrl!}
                  alt={`${isIndividualProfile(entry.kind) ? "Ảnh chân dung" : "Logo"} ${content.name}`}
                  className="size-full object-contain"
                />
              ) : (
                <ProfileTypeIcon kind={entry.kind} roles={content.personRoles} className="size-6" />
              )}
            </span>
            {access.canWrite && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -bottom-1 -right-1 size-8 rounded-full border shadow-sm"
                aria-label={isIndividualProfile(entry.kind) ? "Chỉnh sửa ảnh chân dung" : "Chỉnh sửa logo"}
                title={isIndividualProfile(entry.kind) ? "Chỉnh sửa ảnh chân dung" : "Chỉnh sửa logo"}
                disabled={uploading || update.isPending}
                onClick={() => setQuickEdit({ type: "image", field: "avatarUrl" })}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="min-w-0 flex-1 basis-48 space-y-2 pt-3">
            <h1 className="type-page-title flex min-w-0 items-center gap-2">
              <span className="break-words">{content.name || "Chưa đặt tên"}</span>
              {community && entry.represented && <OfficialBadge className="size-5" label="Đại diện đã xác minh" />}
              <ProfileCountry country={content.country} />
            </h1>
            <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="break-all">/{entry.code}</span>
              <span
                className={cn(
                  "rounded-full px-2 leading-5",
                  entry.published
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                )}
              >
                {entry.published ? "Đã xuất bản" : "Bản nháp"}
              </span>
            </p>
            {community && (
              <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="Kênh liên hệ công khai">
                {content.links.map((link, index) => (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${access.canWrite ? "Chỉnh sửa" : "Xem"} kênh ${link.label || index + 1}`}
                        disabled={uploading || update.isPending}
                        onClick={() => setQuickEdit({ type: "link", index })}
                        className="relative inline-flex size-8 items-center justify-center rounded-lg border bg-background/60 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <PlatformIcon url={link.url} className="size-8" />
                        {link.official && (
                          <OfficialBadge
                            className="absolute -right-1 -top-1 size-3.5 rounded-full bg-card"
                            label={`${link.label} · Kênh chính thức`}
                          />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {link.label}
                      {link.official ? " · Kênh chính thức" : ""}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {access.canWrite &&
                  popularSocialPlatforms
                    .filter((platform) => !content.links.some((link) => platformOf(link.url).id === platform.id))
                    .map((platform) => (
                      <Tooltip key={platform.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Thêm ${platform.name}`}
                            disabled={uploading || update.isPending}
                            onClick={() => setQuickEdit({ type: "link", index: null, platform: platform.id })}
                            className="relative flex size-8 items-center justify-center rounded-lg border border-dashed bg-background/40 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            <PlatformIcon url={platform.url} className="size-8" />
                            <Plus className="absolute -bottom-1 -right-1 size-3.5 rounded-full border bg-card text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Thêm liên kết {platform.name}</TooltipContent>
                      </Tooltip>
                    ))}
                {access.canWrite && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 border-dashed"
                    aria-label="Thêm kênh liên hệ"
                    title="Thêm kênh liên hệ"
                    disabled={uploading || update.isPending}
                    onClick={() => setQuickEdit({ type: "link", index: null, platform: "website" })}
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
                {!content.links.length && <span className="type-meta">Chưa có kênh liên hệ</span>}
              </div>
            )}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 self-end pt-3 @4xl/profile-editor:ml-auto @4xl/profile-editor:w-auto">
            {entry.published && (
              <Button variant="ghost" asChild>
                <a href={`${publicSite}/pages/${entry.code}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Xem trang
                </a>
              </Button>
            )}
            {access.canWrite && (
              <Button
                disabled={!dirty || missingRole || uploading || update.isPending}
                onClick={() => update.mutate(undefined)}
              >
                <Save className="size-4" />
                Lưu nháp
              </Button>
            )}
            {access.canPublish && (
              <Button
                variant="outline"
                disabled={dirty || uploading || update.isPending || !content.sources.length}
                title={content.sources.length ? undefined : "Thêm ít nhất một nguồn trước khi xuất bản."}
                onClick={() => update.mutate(true)}
              >
                <Send className="size-4" />
                {entry.published ? "Xuất bản thay đổi" : "Xuất bản hồ sơ"}
              </Button>
            )}
            {(access.canWrite || access.canPublish) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Thao tác hồ sơ">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {entry.published && access.canPublish && (
                    <DropdownMenuItem
                      disabled={update.isPending || dirty || uploading}
                      onSelect={() => update.mutate(false)}
                    >
                      <Undo2 />
                      Ngừng xuất bản
                    </DropdownMenuItem>
                  )}
                  {!entry.published && access.canWrite && (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={remove.isPending || uploading}
                      onSelect={async () => {
                        const name = entry.content?.name || entry.code
                        const confirmed = await confirmAction({
                          title: `Xóa bản nháp \u201c${name}\u201d?`,
                          description:
                            "Chỉ xóa được hồ sơ chưa từng xuất bản và chưa có người đại diện. Không hoàn tác được.",
                          confirmLabel: "Xóa bản nháp",
                        })
                        if (confirmed) remove.mutate()
                      }}
                    >
                      <Trash2 />
                      Xóa bản nháp
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-2.5 @3xl/profile-editor:px-5">
          <p className="type-meta flex items-center gap-2" role="status" aria-live="polite">
            {uploading || update.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : dirty ? (
              <Circle className="size-3.5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            {uploading ? "Đang tải ảnh…" : update.isPending ? "Đang lưu…" : dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
          </p>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Hoàn thiện hồ sơ">
            <span className="type-meta mr-1">Hoàn thiện {completed}/4</span>
            {completionItems.map(({ done, label, target, icon: CompletionIcon }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${label}: ${done ? "Đã có" : "Cần bổ sung"}`}
                    disabled={uploading || (target === "images" && !access.canWrite)}
                    onClick={() =>
                      target === "images" ? setQuickEdit({ type: "image", field: "avatarUrl" }) : setTab(target)
                    }
                    className={cn(
                      "relative flex size-7 items-center justify-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                      done
                        ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <CompletionIcon className="size-4" />
                    {done && <Check className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-card" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {label} · {done ? "Đã có" : "Cần bổ sung"}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </header>
      {quickEdit && (access.canWrite || quickEdit.type === "link") && (
        <ProfileQuickEditSheet
          target={quickEdit}
          kind={entry.kind}
          content={content}
          readOnly={!access.canWrite}
          onBusyChange={setUploading}
          onClose={() => setQuickEdit(null)}
          onApply={(patch) => {
            setContent((current) => ({ ...current, ...patch }))
            setQuickEdit(null)
          }}
        />
      )}
      {remove.isError && (
        <p role="alert" className="type-body rounded-lg border border-destructive/30 p-4 text-destructive">
          {pageError(
            remove.error,
            "Không xóa được: hồ sơ vừa thay đổi, đã từng xuất bản, hoặc đang có người đại diện, hoạt động cộng đồng, đội tuyển hay giải đấu dùng đến.",
          )}
        </p>
      )}
      {blocker.state === "blocked" && (
        <div role="alertdialog" aria-label="Thay đổi chưa lưu" className="rounded-lg border bg-card p-4">
          <p className="type-body mb-3">
            {uploading ? "Ảnh đang tải lên, vui lòng chờ." : "Hồ sơ có thay đổi chưa lưu."}
          </p>
          <Button variant="outline" onClick={() => blocker.reset()}>
            Ở lại
          </Button>{" "}
          {!uploading && (
            <Button variant="destructive" onClick={() => blocker.proceed()}>
              Rời trang, bỏ thay đổi
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-5 @3xl/profile-editor:grid @3xl/profile-editor:items-start @3xl/profile-editor:grid-cols-[208px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-20 w-full min-w-0 shrink-0 @3xl/profile-editor:static @3xl/profile-editor:z-auto">
          <nav
            ref={sectionNavigation}
            aria-label="Các phần của hồ sơ"
            className="overflow-x-auto rounded-xl border bg-card p-1.5 shadow-sm [scrollbar-width:thin] @3xl/profile-editor:overflow-visible @3xl/profile-editor:p-2 @3xl/profile-editor:shadow-none"
          >
            <div className="flex w-max min-w-full gap-1 @3xl/profile-editor:w-full @3xl/profile-editor:flex-col">
              <p className="type-label hidden px-3 pb-2 pt-2 text-muted-foreground @3xl/profile-editor:block">
                NỘI DUNG HỒ SƠ
              </p>
              {tabs.map(([value, label, TabIcon, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  disabled={uploading}
                  aria-current={tab === value ? "page" : undefined}
                  className={cn(
                    "type-body flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 @3xl/profile-editor:w-full @3xl/profile-editor:gap-2.5 @3xl/profile-editor:whitespace-normal",
                    tab === value
                      ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <TabIcon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{label}</span>
                  {count !== null && (
                    <span className="type-meta min-w-5 rounded bg-muted px-1 text-center tabular-nums">{count}</span>
                  )}
                </button>
              ))}
            </div>
          </nav>
        </aside>
        <div className="min-w-0 space-y-5">
          {update.isError && (
            <p role="alert" className="type-body rounded-lg border border-destructive/30 p-4 text-destructive">
              {pageError(update.error)}
            </p>
          )}
          {tab === "access" && community ? (
            <Representatives entry={entry} />
          ) : tab === "competitions" && (entry.kind === "ORGANIZATION" || entry.kind === "CIRCUIT") ? (
            <OrganizationCompetitions organizationId={entry.id} actorKey={access.actorKey} kind={entry.kind} />
          ) : (
            <>
              <ProfileFields
                entityId={entry.entityId}
                pageId={entry.id}
                kind={entry.kind}
                content={content}
                onChange={setContent}
                tab={tab}
                disabled={!access.canWrite || update.isPending}
              />
              {entry.kind === "CIRCUIT" && tab === "overview" && (
                <CircuitChannelsField
                  content={content}
                  actorKey={access.actorKey}
                  canWrite={access.canWrite}
                  busy={uploading || update.isPending}
                  onOrganizationChange={(channelOrganizationId) =>
                    setContent((current) => ({ ...current, channelOrganizationId }))
                  }
                  onEditLink={(index) => setQuickEdit({ type: "link", index })}
                />
              )}
            </>
          )}
        </div>
      </div>
    </Page>
  )
}
/** Editors can announce a page's broadcast while the page has no representative to do it. */
function LiveSection({ entry }: { entry: CommunityProfile }) {
  const client = useQueryClient()
  const [url, setUrl] = useState(entry.live?.url || "")
  const [title, setTitle] = useState(entry.live?.title || "")
  const start = useMutation({
    mutationFn: () => pageApi.startLive(entry.id, url, title),
    onSuccess: () => client.invalidateQueries({ queryKey: pageKeys }),
  })
  const end = useMutation({
    mutationFn: () => pageApi.endLive(entry.id),
    onSuccess: () => client.invalidateQueries({ queryKey: pageKeys }),
  })
  const failure = start.error || end.error
  return (
    <Section
      title="Phát trực tiếp"
      icon={Radio}
      description="Dán liên kết buổi phát trên YouTube, Facebook hoặc TikTok. Người theo dõi nhận thông báo khi bật; trạng thái tự tắt sau 12 giờ."
    >
      {entry.live && (
        <p className="type-body">
          Đang phát: <strong>{entry.live.title}</strong> · từ{" "}
          <LocalTime value={entry.live.startedAt} format={{ dateStyle: "short", timeStyle: "short" }} />
        </p>
      )}
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          start.mutate()
        }}
      >
        <label className="grid gap-1.5">
          <span className="type-label">Liên kết buổi phát</span>
          <Input
            required
            type="url"
            maxLength={2000}
            value={url}
            placeholder="https://www.youtube.com/live/…"
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="type-label">Tiêu đề</span>
          <Input
            required
            maxLength={200}
            value={title}
            placeholder="ĐTDV mùa Đông · Tuần 3"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={start.isPending}>
            <Radio className="size-4" />
            {entry.live ? "Cập nhật" : "Bật trực tiếp"}
          </Button>
          {entry.live && (
            <Button type="button" variant="outline" disabled={end.isPending} onClick={() => end.mutate()}>
              Tắt
            </Button>
          )}
        </div>
      </form>
      {failure && (
        <p role="alert" className="type-body text-destructive">
          {pageError(failure)}
        </p>
      )}
    </Section>
  )
}

function Representatives({ entry }: { entry: CommunityProfile }) {
  const client = useQueryClient()
  const members = useQuery({ queryKey: [...pageKeys, entry.id, "members"], queryFn: () => pageApi.members(entry.id) })
  const [confirm, setConfirm] = useState<string | null>(null)
  const revoke = useMutation({
    mutationFn: (id: string) => pageApi.revoke(entry.id, id),
    onSuccess: async () => {
      setConfirm(null)
      await client.invalidateQueries({ queryKey: pageKeys })
    },
  })
  const owned = members.data?.some((member) => member.role === "OWNER")
  return (
    <>
      {entry.published && <LiveSection entry={entry} />}
      {members.isSuccess && !owned && <Handover entry={entry} />}
      <Section
        title="Người đại diện"
        icon={ShieldCheck}
        description="Quyền đại diện cho phép quản lý hoạt động của trang; dữ liệu thi đấu vẫn được biên tập riêng."
      >
        {members.isError ? (
          <p role="alert" className="type-body">
            {pageError(members.error)}
          </p>
        ) : !members.data?.length ? (
          <p className="type-body text-muted-foreground">
            Chưa có người đại diện. Hồ sơ vẫn có thể xuất bản từ nguồn đã đối chiếu.
          </p>
        ) : (
          members.data.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
              <span className="type-body flex-1">
                {member.name} ·{" "}
                {member.role === "OWNER"
                  ? "Quản trị chính"
                  : member.role === "EDITOR"
                    ? "Biên tập viên"
                    : "Kiểm duyệt viên"}
              </span>
              {confirm === member.id ? (
                <>
                  <span className="type-meta">
                    {member.role === "OWNER" ? "Thu hồi sẽ gỡ toàn bộ nhóm đại diện." : "Xác nhận thu hồi quyền?"}
                  </span>
                  <Button variant="destructive" disabled={revoke.isPending} onClick={() => revoke.mutate(member.id)}>
                    Xác nhận thu hồi
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(null)}>
                    Hủy
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setConfirm(member.id)}>
                  Thu hồi quyền
                </Button>
              )}
            </div>
          ))
        )}
        {revoke.isError && <p className="type-body text-destructive">{pageError(revoke.error)}</p>}
        <Button variant="outline" asChild>
          <Link to="/page-requests">Xem yêu cầu nhận trang</Link>
        </Button>
      </Section>
    </>
  )
}

/**
 * Hands an ownerless page to its real organization, team or player: AthaHub manages the page until they contact us,
 * then they accept a one-time link with their own account. No shared account or password is involved.
 */
function Handover({ entry }: { entry: CommunityProfile }) {
  const client = useQueryClient()
  const key = [...pageKeys, entry.id, "handover"]
  const status = useQuery({ queryKey: key, queryFn: () => pageApi.handover(entry.id), enabled: entry.published })
  const [link, setLink] = useState("")
  const [copied, setCopied] = useState(false)
  const issue = useMutation({
    mutationFn: () => pageApi.issueHandover(entry.id),
    onSuccess: async (issued) => {
      setLink(`${publicSite}/invitations#${issued.token}`)
      setCopied(false)
      await client.invalidateQueries({ queryKey: key })
    },
  })
  const cancel = useMutation({
    mutationFn: () => pageApi.cancelHandover(entry.id),
    onSuccess: async () => {
      setLink("")
      await client.invalidateQueries({ queryKey: key })
    },
  })
  const busy = issue.isPending || cancel.isPending
  const failure = issue.error ?? cancel.error ?? status.error
  const pending = status.data?.pending ?? false

  return (
    <Section
      title="Bàn giao cho chủ trang"
      icon={KeyRound}
      description="Trang đang do AthaHub quản lý. Khi tổ chức liên hệ qua kênh chính thức và đã được xác minh, tạo liên kết bàn giao để họ nhận quyền quản trị chính bằng tài khoản của chính họ."
    >
      {!entry.published ? (
        <p className="type-body text-muted-foreground">Xuất bản hồ sơ trước khi bàn giao.</p>
      ) : link ? (
        <div className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <span className="type-label">Liên kết bàn giao · dùng một lần, hết hạn sau 7 ngày</span>
          <div className="flex gap-2">
            <Input readOnly value={link} aria-label="Liên kết bàn giao" onFocus={(event) => event.target.select()} />
            <Button
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(link)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false))
              }
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Đã chép" : "Chép"}
            </Button>
          </div>
          <p className="type-meta">
            Liên kết chỉ hiển thị lần này. Gửi riêng cho người đại diện đã xác minh; họ đăng nhập AthaHub bằng tài khoản
            của mình rồi mở liên kết để nhận quyền.
          </p>
        </div>
      ) : pending && status.data?.expiresAt ? (
        <p className="type-body">
          Đang có một liên kết bàn giao chưa dùng, hết hạn{" "}
          <LocalTime value={status.data.expiresAt} format={{ dateStyle: "short", timeStyle: "short" }} />. Tạo liên kết
          mới sẽ vô hiệu liên kết cũ.
        </p>
      ) : (
        <p className="type-body text-muted-foreground">Chưa có liên kết bàn giao nào đang hiệu lực.</p>
      )}
      {entry.published && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || status.isPending} onClick={() => issue.mutate()}>
            <KeyRound className="size-4" />
            {pending || link ? "Tạo liên kết mới" : "Tạo liên kết bàn giao"}
          </Button>
          {(pending || link) && (
            <Button variant="ghost" disabled={busy} onClick={() => cancel.mutate()}>
              Hủy liên kết
            </Button>
          )}
        </div>
      )}
      {failure && (
        <p role="alert" className="type-body text-destructive">
          {pageError(failure, "Trang đã có chủ hoặc chưa xuất bản. Tải lại để xem trạng thái mới.")}
        </p>
      )}
    </Section>
  )
}
