import { useState, type ComponentType } from "react"
import { Link, useBeforeUnload, useNavigate, useParams, useBlocker } from "react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  BookOpenText,
  Building2,
  Check,
  Circle,
  CircleCheck,
  Copy,
  ExternalLink,
  History,
  Info,
  KeyRound,
  MoreHorizontal,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Undo2,
  UserRound,
  Users,
} from "lucide-react"
import { profileKindLabels, type CommunityProfile, type ProfileKind } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { Input } from "@aov/ui/components/input"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { cn } from "@aov/ui/lib/utils"
import { Page } from "@/components/page-header"
import { AccessGate, type Access } from "@/features/esports/pages/esports-shell"
import { formatDateTime } from "@/lib/text"
import { pageApi, pageError, pageKeys, publicSite } from "./page-api"
import { ProfileFields, Section } from "./profile-fields"
import { profileDirectoryPath } from "./page-directory"

export function PageEditor() {
  return <AccessGate>{(access) => <EditorLoader access={access} />}</AccessGate>
}
function EditorLoader({ access }: { access: Access }) {
  const { pageId = "" } = useParams()
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
  return <Editor key={`${query.data.id}:${query.data.version}`} entry={query.data} access={access} />
}
type Icon = ComponentType<{ className?: string }>
type Tab = [string, string, Icon, number | null]
const kindIcons: Record<ProfileKind, Icon> = { ORGANIZATION: Building2, TEAM: Users, PLAYER: UserRound }
const httpUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)

function Editor({ entry, access }: { entry: CommunityProfile; access: Access }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [content, setContent] = useState(entry.content!)
  const [tab, setTab] = useState("overview")
  const [uploading, setUploading] = useState(false)
  const dirty = JSON.stringify(content) !== JSON.stringify(entry.content)
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
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: pageKeys })
    },
  })
  const remove = useMutation({
    mutationFn: () => pageApi.remove(entry),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: pageKeys })
      void navigate(profileDirectoryPath(entry.kind))
    },
  })
  const tabs: Tab[] = [
    ["overview", "Tổng quan", Info, null],
    ...(entry.kind === "PLAYER" ? [] : [["roster", "Thành viên", Users, content.roster.length] as Tab]),
    ["history", entry.kind === "PLAYER" ? "Sự nghiệp" : "Lịch sử", History, content.history.length],
    ["achievements", "Thành tích", Trophy, content.achievements.length],
    ["sources", "Nguồn thông tin", BookOpenText, content.sources.length],
    ...(access.canPublish ? [["access", "Quyền đại diện", ShieldCheck, null] as Tab] : []),
  ]
  const KindIcon = kindIcons[entry.kind]
  const completed = [!!content.name, !!content.biography, !!content.avatarUrl, content.sources.length > 0].filter(
    Boolean,
  ).length
  return (
    <Page className="mx-auto w-full max-w-[1400px] gap-5">
      <Link
        className="type-meta flex w-fit items-center gap-1.5 hover:text-foreground"
        to={profileDirectoryPath(entry.kind)}
      >
        <ArrowLeft className="size-3.5" />
        {profileKindLabels[entry.kind]}
      </Link>
      {/* Previews the public page header: cover, logo, name and who stands behind the page. */}
      <header className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-28 bg-gradient-to-r from-muted via-muted/50 to-muted sm:h-40">
          {httpUrl(content.coverUrl) && <img src={content.coverUrl!} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex flex-wrap items-end gap-4 px-4 pb-4 sm:px-6">
          <span className="-mt-10 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-muted text-muted-foreground sm:-mt-12 sm:size-24">
            {httpUrl(content.avatarUrl) ? (
              <img src={content.avatarUrl!} alt="" className="size-full object-contain" />
            ) : (
              <KindIcon className="size-8" />
            )}
          </span>
          <div className="min-w-0 grow basis-64 space-y-1.5 pt-3">
            <h1 className="type-page-title flex min-w-0 items-center gap-2">
              <span className="break-words">{content.name || "Chưa đặt tên"}</span>
              {entry.represented && <OfficialBadge className="size-5" label="Đại diện đã xác minh" />}
            </h1>
            <p className="type-meta flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <KindIcon className="size-3.5" />
                {profileKindLabels[entry.kind]}
              </span>
              <span className="font-mono">/{entry.code}</span>
              <span
                className={cn(
                  "rounded-full px-2 leading-5",
                  entry.published
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                )}
              >
                {entry.published ? "Đã công bố" : "Bản nháp"}
              </span>
              <span>{entry.represented ? "Đại diện đã xác minh" : "AthaHub tổng hợp"}</span>
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {entry.published && (
              <Button variant="outline" asChild>
                <a href={`${publicSite}/pages/${entry.code}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Xem trang công khai
                </a>
              </Button>
            )}
            {access.canWrite && (
              <Button disabled={!dirty || uploading || update.isPending} onClick={() => update.mutate(undefined)}>
                <Save className="size-4" />
                Lưu nháp
              </Button>
            )}
            {access.canPublish && (
              <Button
                variant="secondary"
                disabled={dirty || uploading || update.isPending || !content.sources.length}
                title={content.sources.length ? undefined : "Thêm ít nhất một nguồn trước khi công bố."}
                onClick={() => update.mutate(true)}
              >
                <Send className="size-4" />
                Công bố bản này
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
                      Thu hồi công bố
                    </DropdownMenuItem>
                  )}
                  {!entry.published && access.canWrite && (
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={remove.isPending || uploading}
                      onSelect={() => {
                        const name = entry.content?.name || entry.code
                        const message =
                          "Xóa bản nháp \u201c" +
                          name +
                          "\u201d? Chỉ xóa được hồ sơ chưa từng công bố và chưa có người đại diện. Không hoàn tác được."
                        if (window.confirm(message)) remove.mutate()
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
      </header>
      {remove.isError && (
        <p role="alert" className="type-body rounded-lg border border-destructive/30 p-4 text-destructive">
          {pageError(
            remove.error,
            "Không xóa được: hồ sơ vừa thay đổi, đã từng công bố, hoặc đang có người đại diện, hoạt động cộng đồng hay giải đấu dùng đến.",
          )}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        {blocker.state === "blocked" && (
          <div
            role="alertdialog"
            aria-label="Thay đổi chưa lưu"
            className="rounded-lg border bg-card p-4 lg:col-span-2"
          >
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
        <div className="min-w-0 space-y-5">
          <nav
            aria-label="Các phần của hồ sơ"
            className="flex gap-1 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map(([value, label, TabIcon, count]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                disabled={uploading}
                aria-current={tab === value ? "page" : undefined}
                className={cn(
                  "type-body flex shrink-0 items-center gap-2 border-b-2 px-3 py-3",
                  tab === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon className="size-4" />
                {label}
                {count !== null && <span className="type-meta tabular-nums">{count}</span>}
              </button>
            ))}
          </nav>
          {update.isError && (
            <p role="alert" className="type-body rounded-lg border border-destructive/30 p-4 text-destructive">
              {pageError(update.error)}
            </p>
          )}
          {tab === "access" ? (
            <Representatives entry={entry} />
          ) : (
            <ProfileFields
              kind={entry.kind}
              onBusyChange={setUploading}
              content={content}
              onChange={setContent}
              tab={tab}
              disabled={!access.canWrite || update.isPending}
            />
          )}
        </div>
        <aside className="space-y-4 lg:pt-16">
          <Section title="Hoàn thiện hồ sơ">
            <p className="type-body">{completed}/4 mục cơ bản</p>
            <div className="h-1.5 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary" style={{ width: `${completed * 25}%` }} />
            </div>
            <ul className="type-body space-y-1">
              {(
                [
                  [!!content.name, "Tên hiển thị", "overview"],
                  [!!content.biography, "Giới thiệu", "overview"],
                  [!!content.avatarUrl, entry.kind === "PLAYER" ? "Ảnh tuyển thủ" : "Logo", "overview"],
                  [!!content.sources.length, "Nguồn đối chiếu", "sources"],
                ] as const
              ).map(([done, label, target]) => (
                <li key={label}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted",
                      done ? "text-foreground" : "text-muted-foreground",
                    )}
                    onClick={() => setTab(target)}
                  >
                    {done ? (
                      <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="size-4 shrink-0" />
                    )}
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Trạng thái">
            <p className="type-body">{dirty ? "Có thay đổi chưa lưu" : "Đã lưu bản nháp"}</p>
            <p className="type-meta">Lưu nháp không thay đổi nội dung đang công khai.</p>
          </Section>
        </aside>
      </div>
    </Page>
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
            Chưa có người đại diện. Hồ sơ vẫn có thể công bố từ nguồn đã đối chiếu.
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
        <p className="type-body text-muted-foreground">Công bố hồ sơ trước khi bàn giao.</p>
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
          Đang có một liên kết bàn giao chưa dùng, hết hạn {formatDateTime(status.data.expiresAt)}. Tạo liên kết mới sẽ
          vô hiệu liên kết cũ.
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
          {pageError(failure, "Trang đã có chủ hoặc chưa công bố. Tải lại để xem trạng thái mới.")}
        </p>
      )}
    </Section>
  )
}
