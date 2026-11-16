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
import { useStreamLocale } from "../../components/stream-locale"
import { communityApi } from "./community-api"
import { formatDay } from "./community-ui"
import { useSignedInAction } from "./community-signin"

type ProfileDialog = "sources" | "suggestion" | "claim"

const dialogTitles: Record<ProfileDialog, readonly [string, string]> = {
  sources: ["Nguồn thông tin", "Sources"],
  suggestion: ["Đề xuất chỉnh sửa", "Suggest an edit"],
  claim: ["Yêu cầu quản lý trang", "Request to manage page"],
}

export function ProfileOptions({ profile, role }: { profile: CommunityProfile; role?: PageRole | null }) {
  const { text } = useStreamLocale()
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
            ? text(
                "Đăng nhập bằng tài khoản của bạn để gửi yêu cầu quản lý trang.",
                "Sign in with your account to send a request to manage the page.",
              )
            : text(
                "Đăng nhập để gửi đề xuất chỉnh sửa đến đội ngũ biên tập.",
                "Sign in to send an edit suggestion to the editorial team.",
              ),
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
            aria-label={text("Tùy chọn trang", "Page options")}
            title={text("Tùy chọn trang", "Page options")}
          >
            <StreamIcon name="more" size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="hub-popover cp-profile-options-menu"
          drawerTitle={text("Tùy chọn trang", "Page options")}
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
            {text("Nguồn thông tin", "Sources")}
          </DropdownMenuItem>
          <DropdownMenuItem className="hub-menu-item" onSelect={() => choose("suggestion")}>
            <StreamIcon name="edit" size={16} />
            {text("Đề xuất chỉnh sửa", "Suggest an edit")}
          </DropdownMenuItem>
          {isCommunityProfile(profile.kind) && <DropdownMenuSeparator className="cp-profile-menu-separator" />}
          {isCommunityProfile(profile.kind) &&
            (role ? (
              <DropdownMenuItem asChild className="hub-menu-item">
                <Link to={`/manage/${profile.id}`}>
                  <StreamIcon name="shield" size={16} />
                  {text("Quản lý trang", "Manage page")}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem className="hub-menu-item" onSelect={() => choose("claim")}>
                <StreamIcon name="shield" size={16} />
                {text("Yêu cầu quản lý trang", "Request to manage page")}
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
              <DialogTitle>{text(...dialogTitles[dialog])}</DialogTitle>
              <DialogDescription>{profile.content?.name || profile.code}</DialogDescription>
            </div>
            <DialogClose asChild>
              <button type="button" className="hub-icon-button" aria-label={text("Đóng", "Close")}>
                <StreamIcon name="close" size={16} />
              </button>
            </DialogClose>
          </div>
          {dialog === "sources" && (
            <div className="cp-profile-dialog-body">
              <p className="cp-profile-info-note">
                <StreamIcon name="info" size={18} />
                {!isCommunityProfile(profile.kind)
                  ? text(
                      "Trang thông tin hệ thống giải do AthaHub biên tập từ nguồn công khai.",
                      "Tournament circuit information page edited by AthaHub from public sources.",
                    )
                  : profile.represented
                    ? text("Trang có đại diện đã xác minh.", "This page has a verified representative.")
                    : text(
                        "Hồ sơ do AthaHub tổng hợp từ nguồn công khai.",
                        "Profile compiled by AthaHub from public sources.",
                      )}
              </p>
              {sources.length ? (
                <ul className="cp-profile-sources">
                  {sources.map((source, i) => (
                    <li key={i}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        <span>
                          <strong>{source.label}</strong>
                          {source.checkedOn && (
                            <small>
                              {text("Đối chiếu", "Checked on")} {formatDay(source.checkedOn)}
                            </small>
                          )}
                        </span>
                        <StreamIcon name="external" size={15} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cp-muted">{text("Chưa có nguồn được công bố.", "No sources published yet.")}</p>
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
  // `text` is the request being typed here, so the wording picker goes by `ui`.
  const { text: ui } = useStreamLocale()
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
        <strong>
          {isClaim ? ui("Đã gửi yêu cầu quản lý", "Management request sent") : ui("Đã gửi đề xuất", "Suggestion sent")}
        </strong>
        <p>
          {isClaim
            ? ui("Bạn có thể xem tiến trình tại tài khoản của mình.", "You can track its progress in your account.")
            : ui(
                "Đội ngũ biên tập sẽ đối chiếu thông tin bạn cung cấp.",
                "The editorial team will check the information you provided.",
              )}
        </p>
        <DialogClose asChild>
          <button type="button" className="cp-button">
            {ui("Đóng", "Close")}
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
        signedIn(
          ui("Đăng nhập để gửi thông tin đến đội ngũ biên tập.", "Sign in to send information to the editorial team."),
          () => request.mutate(),
        )
      }}
    >
      <p className="cp-muted">
        {isClaim
          ? ui(
              "Nhận quyền quản lý để cập nhật giới thiệu và đăng bài dưới tên trang.",
              "Get management access to update the introduction and post under the page's name.",
            )
          : ui(
              "Gửi thông tin cần sửa cùng nguồn đối chiếu để đội ngũ biên tập kiểm tra.",
              "Send the information to correct along with reference sources for the editorial team to check.",
            )}
      </p>
      <label>
        {isClaim
          ? ui("Kênh chính thức và bằng chứng đại diện", "Official channels and proof of representation")
          : ui("Nội dung và nguồn bổ sung", "Details and additional sources")}
        <textarea
          required
          rows={5}
          maxLength={isClaim ? 4000 : 2000}
          value={text}
          disabled={request.isPending}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            isClaim
              ? ui(
                  "Vai trò của bạn, liên kết kênh chính thức và cách đối chiếu…",
                  "Your role, links to official channels and how to verify them…",
                )
              : ui("Thông tin cần sửa, liên kết nguồn…", "Information to correct, source links…")
          }
        />
      </label>
      {isClaim && (
        <p className="cp-meta">
          {ui(
            "Thông tin này chỉ dùng để xét duyệt, không hiển thị trên hồ sơ.",
            "This information is used for review only and is not shown on the profile.",
          )}
        </p>
      )}
      {request.isError && (
        <p className="cp-error" role="alert">
          {request.error.message}
        </p>
      )}
      <div className="cp-profile-dialog-actions">
        <DialogClose asChild>
          <button type="button" className="cp-button">
            {ui("Hủy", "Cancel")}
          </button>
        </DialogClose>
        <button type="submit" className="cp-button cp-primary" disabled={request.isPending || !text.trim()}>
          {request.isPending
            ? ui("Đang gửi…", "Sending…")
            : isClaim
              ? ui("Gửi yêu cầu", "Send request")
              : ui("Gửi đề xuất", "Send suggestion")}
        </button>
      </div>
    </form>
  )
}
