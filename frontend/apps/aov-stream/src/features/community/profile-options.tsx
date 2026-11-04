import { useRef, useState } from "react"
import { Link } from "react-router"
import { useMutation } from "@tanstack/react-query"
import { isCommunityProfile, type CommunityProfile, type PageRole } from "@aov/community-contracts"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@aov/ui/components/public-overlay"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { formatDay } from "./community-ui"
import { useSignedInAction } from "./community-signin"

type ProfileDialog = "sources" | "suggestion" | "claim"

const dialogTitles: Record<ProfileDialog, string> = {
  sources: "Nguồn thông tin",
  suggestion: "Đề xuất chỉnh sửa",
  claim: "Yêu cầu quản lý trang",
}

export function ProfileOptions({ profile, role }: { profile: CommunityProfile; role?: PageRole | null }) {
  const signedIn = useSignedInAction()
  const [dialog, setDialog] = useState<ProfileDialog>("sources")
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const afterMenuClose = useRef<(() => void) | null>(null)
  const sources = profile.content?.sources || []

  function choose(next: ProfileDialog) {
    // Open dialogs after the menu restores focus, so dismissal returns to its trigger.
    afterMenuClose.current = () => {
      const showDialog = () => {
        setDialog(next)
        setOpen(true)
      }
      if (next === "sources") showDialog()
      else
        signedIn(
          next === "claim"
            ? "Đăng nhập bằng tài khoản của bạn để gửi yêu cầu quản lý trang."
            : "Đăng nhập để gửi đề xuất chỉnh sửa đến đội ngũ biên tập.",
          showDialog,
        )
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            ref={trigger}
            type="button"
            className="cp-button cp-profile-options-trigger"
            aria-label="Tùy chọn trang"
            title="Tùy chọn trang"
          >
            <StreamIcon name="more" size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="hub-popover cp-profile-options-menu"
          drawerTitle="Tùy chọn trang"
          onCloseAutoFocus={(event) => {
            if (!afterMenuClose.current) return
            event.preventDefault()
            trigger.current?.focus()
            const action = afterMenuClose.current
            afterMenuClose.current = null
            action()
          }}
        >
          <DropdownMenuItem className="hub-menu-item" onSelect={() => choose("sources")}>
            <StreamIcon name="link" size={16} />
            Nguồn thông tin
          </DropdownMenuItem>
          <DropdownMenuItem className="hub-menu-item" onSelect={() => choose("suggestion")}>
            <StreamIcon name="edit" size={16} />
            Đề xuất chỉnh sửa
          </DropdownMenuItem>
          {isCommunityProfile(profile.kind) && <DropdownMenuSeparator className="cp-profile-menu-separator" />}
          {isCommunityProfile(profile.kind) &&
            (role ? (
              <DropdownMenuItem asChild className="hub-menu-item">
                <Link to={`/manage/${profile.id}`}>
                  <StreamIcon name="shield" size={16} />
                  Quản lý trang
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="hub-menu-item" onSelect={() => choose("claim")}>
                <StreamIcon name="shield" size={16} />
                Yêu cầu quản lý trang
              </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="cp-container cp-profile-dialog"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <div className="cp-profile-dialog-heading">
            <div>
              <DialogTitle>{dialogTitles[dialog]}</DialogTitle>
              <DialogDescription>{profile.content?.name || profile.code}</DialogDescription>
            </div>
            <DialogClose asChild>
              <button type="button" className="hub-icon-button" aria-label="Đóng">
                <StreamIcon name="close" size={16} />
              </button>
            </DialogClose>
          </div>
          {dialog === "sources" && (
            <div className="cp-profile-dialog-body">
              <p className="cp-profile-info-note">
                <StreamIcon name="info" size={18} />
                {!isCommunityProfile(profile.kind)
                  ? "Trang thông tin hệ thống giải do AthaHub biên tập từ nguồn công khai."
                  : profile.represented
                    ? "Trang có đại diện đã xác minh."
                    : "Hồ sơ do AthaHub tổng hợp từ nguồn công khai."}
              </p>
              {sources.length ? (
                <ul className="cp-profile-sources">
                  {sources.map((source, i) => (
                    <li key={i}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        <span>
                          <strong>{source.label}</strong>
                          {source.checkedOn && <small>Đối chiếu {formatDay(source.checkedOn)}</small>}
                        </span>
                        <StreamIcon name="external" size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cp-muted">Chưa có nguồn được công bố.</p>
              )}
            </div>
          )}
          {(dialog === "suggestion" || dialog === "claim") && (
            <ProfileRequestForm key={dialog} pageId={profile.id} kind={dialog} />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ProfileRequestForm({ pageId, kind }: { pageId: string; kind: "suggestion" | "claim" }) {
  const signedIn = useSignedInAction()
  const [text, setText] = useState("")
  const isClaim = kind === "claim"
  const request = useMutation({
    mutationFn: () =>
      communityApi(
        `/me/pages/${pageId}/${isClaim ? "claims" : "reports"}`,
        isClaim ? { evidence: text } : { reason: text },
      ),
  })

  if (request.isSuccess)
    return (
      <div className="cp-profile-request-success" role="status">
        <StreamIcon name="check" size={24} />
        <strong>{isClaim ? "Đã gửi yêu cầu quản lý" : "Đã gửi đề xuất"}</strong>
        <p>
          {isClaim
            ? "Bạn có thể xem tiến trình tại tài khoản của mình."
            : "Đội ngũ biên tập sẽ đối chiếu thông tin bạn cung cấp."}
        </p>
        <DialogClose asChild>
          <button type="button" className="cp-button">
            Đóng
          </button>
        </DialogClose>
      </div>
    )

  return (
    <form
      className="cp-profile-dialog-body"
      onSubmit={(event) => {
        event.preventDefault()
        if (request.isPending || !text.trim()) return
        signedIn("Đăng nhập để gửi thông tin đến đội ngũ biên tập.", () => request.mutate())
      }}
    >
      <p className="cp-muted">
        {isClaim
          ? "Nhận quyền quản lý để cập nhật giới thiệu và đăng bài dưới tên trang."
          : "Gửi thông tin cần sửa cùng nguồn đối chiếu để đội ngũ biên tập kiểm tra."}
      </p>
      <label>
        {isClaim ? "Kênh chính thức và bằng chứng đại diện" : "Nội dung và nguồn bổ sung"}
        <textarea
          required
          rows={5}
          maxLength={isClaim ? 4000 : 2000}
          value={text}
          disabled={request.isPending}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            isClaim
              ? "Vai trò của bạn, liên kết kênh chính thức và cách đối chiếu…"
              : "Thông tin cần sửa, liên kết nguồn…"
          }
        />
      </label>
      {isClaim && <p className="cp-meta">Thông tin này chỉ dùng để xét duyệt, không hiển thị trên hồ sơ.</p>}
      {request.isError && (
        <p className="cp-error" role="alert">
          {request.error.message}
        </p>
      )}
      <div className="cp-profile-dialog-actions">
        <DialogClose asChild>
          <button type="button" className="cp-button">
            Hủy
          </button>
        </DialogClose>
        <button type="submit" className="cp-button cp-primary" disabled={request.isPending || !text.trim()}>
          {request.isPending ? "Đang gửi…" : isClaim ? "Gửi yêu cầu" : "Gửi đề xuất"}
        </button>
      </div>
    </form>
  )
}
