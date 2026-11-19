import { useState, type CSSProperties } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import type { CommunityProfile, PageManager, PageViewer } from "@aov/community-contracts"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/public-overlay"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { initials } from "../../../lib/profile-model"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { useCommunitySession } from "../../../lib/stream-auth"
import { hueOf } from "../../../components/community-ui"
import { useManagerRefresh } from "./use-manager-refresh"

/** The roles of a page's managers, in Vietnamese and in English. */

export const roleLabels: Record<PageManager["role"], readonly [string, string]> = {
  OWNER: ["Quản trị chính", "Owner"],
  EDITOR: ["Biên tập viên", "Editor"],
  MODERATOR: ["Kiểm duyệt viên", "Moderator"],
}

/** The managers of a page; its owner invites new ones, transfers ownership and revokes access. */
export function PageMembers({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const { text } = useStreamLocale()
  const session = useCommunitySession()
  const refresh = useManagerRefresh()
  const [inviteRole, setInviteRole] = useState("EDITOR")
  const [invitation, setInvitation] = useState("")
  const [copied, setCopied] = useState(false)
  const [confirmation, setConfirmation] = useState<{ id: string; action: "revoke" | "transfer" } | null>(null)
  const members = useQuery({
    queryKey: communityKeys.members(session.revision, profile.id),
    queryFn: () => communityApi.members(profile.id),
  })
  const invite = useMutation({
    mutationFn: () => communityApi.invite(profile.id, inviteRole),
    onSuccess: (value) => {
      setCopied(false)
      setInvitation(`${location.origin}${import.meta.env.BASE_URL}invitations#${value.token}`)
    },
  })
  const membership = useMutation({
    mutationFn: () => communityApi.changeMember(profile.id, confirmation!.id, confirmation!.action),
    onSuccess: async () => {
      setConfirmation(null)
      await refresh()
    },
  })
  const owner = viewer.role === "OWNER"
  const copy = () =>
    void navigator.clipboard
      ?.writeText(invitation)
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  return (
    <section className="cp-section" aria-labelledby="manage-members">
      <div className="tn-heading" data-flush="">
        <h2 id="manage-members">
          {text("Người quản lý", "Managers")} {!!members.data?.length && <small>{members.data.length}</small>}
        </h2>
      </div>
      <p className="cp-section-lead">
        {text(
          "Biên tập viên đăng bài dưới tên trang; kiểm duyệt viên ẩn nội dung vi phạm. Chỉ quản trị chính mời và thu hồi.",
          "Editors post under the page's name; moderators hide content that breaks the rules. Only the main admin invites and removes people.",
        )}
      </p>
      {members.isPending && (
        <div
          className="hub-skeleton-rows"
          role="status"
          aria-label={text("Đang tải người quản lý", "Loading managers")}
        />
      )}
      {members.isError && <p className="cp-error">{members.error.message}</p>}
      {!!members.data?.length && (
        <ul className="cp-rows">
          {members.data.map((member) => (
            <li key={member.id}>
              <div className="cp-row">
                <span
                  className="cp-row-avatar cp-initial"
                  style={{ "--hub-hue": hueOf(member.name) } as CSSProperties}
                  aria-hidden="true"
                >
                  {initials(member.name)}
                </span>
                <span className="cp-row-text">
                  <strong>
                    {member.name}
                    {member.self && text(" (bạn)", " (you)")}
                  </strong>
                  <small>{text(...roleLabels[member.role])}</small>
                </span>
                {owner && !member.self && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="hub-icon-button cp-more"
                        aria-label={text(`Thao tác với ${member.name}`, `Actions for ${member.name}`)}
                      >
                        <StreamIcon name="more" size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="hub-popover hub-post-menu" drawerTitle={member.name}>
                      <DropdownMenuItem
                        className="hub-menu-item"
                        onSelect={() => setConfirmation({ id: member.id, action: "transfer" })}
                      >
                        <StreamIcon name="shield" size={16} />
                        {text("Chuyển quyền chính", "Transfer ownership")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="hub-menu-item"
                        variant="destructive"
                        onSelect={() => setConfirmation({ id: member.id, action: "revoke" })}
                      >
                        <StreamIcon name="close" size={16} />
                        {text("Thu hồi quyền", "Revoke access")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {confirmation?.id === member.id && (
                <div
                  className="cp-confirm"
                  role="group"
                  aria-label={text("Xác nhận thay đổi quyền", "Confirm the role change")}
                >
                  <p>
                    {confirmation.action === "transfer"
                      ? text(
                          `${member.name} sẽ trở thành quản trị chính; bạn chuyển thành biên tập viên. Các lời mời cũ hết hiệu lực.`,
                          `${member.name} will become the owner; you will become an editor. Old invitations will no longer be valid.`,
                        )
                      : text(
                          `${member.name} sẽ mất quyền quản lý trang này.`,
                          `${member.name} will lose management access to this page.`,
                        )}
                  </p>
                  <div className="cp-actions">
                    <button
                      className={confirmation.action === "revoke" ? "cp-button cp-danger" : "cp-button cp-primary"}
                      disabled={membership.isPending}
                      onClick={() => membership.mutate()}
                    >
                      {confirmation.action === "revoke"
                        ? text("Thu hồi quyền", "Revoke access")
                        : text("Chuyển quyền chính", "Transfer ownership")}
                    </button>
                    <button className="cp-button cp-quiet" onClick={() => setConfirmation(null)}>
                      {text("Hủy", "Cancel")}
                    </button>
                  </div>
                  {membership.isError && (
                    <p className="cp-field-error" role="alert">
                      {membership.error.message}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {owner && (
        <div className="cp-invite">
          <h3 className="cp-subheading">{text("Mời người quản lý", "Invite a manager")}</h3>
          <p className="cp-section-lead">
            {text(
              "Tạo một liên kết dùng một lần, có hiệu lực 7 ngày, rồi gửi riêng cho người bạn muốn cấp quyền.",
              "Create a single-use link, valid for 7 days, then send it privately to the person you want to grant access to.",
            )}
          </p>
          <div className="cp-invite-row">
            <label className="cp-invite-role">
              {text("Quyền", "Role")}
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                <option value="EDITOR">{text("Biên tập viên", "Editor")}</option>
                <option value="MODERATOR">{text("Kiểm duyệt viên", "Moderator")}</option>
              </select>
            </label>
            <button className="cp-button cp-primary" disabled={invite.isPending} onClick={() => invite.mutate()}>
              {text("Tạo liên kết mời", "Create invitation link")}
            </button>
          </div>
          {invite.isError && (
            <p className="cp-field-error" role="alert">
              {invite.error.message}
            </p>
          )}
          {invitation && (
            <div className="cp-invite-row">
              <label>
                {text("Liên kết mời", "Invitation link")}
                <input readOnly value={invitation} onFocus={(event) => event.target.select()} />
              </label>
              <button type="button" className="cp-button" onClick={copy}>
                <StreamIcon name={copied ? "check" : "link"} size={15} />
                {copied ? text("Đã sao chép", "Copied") : text("Sao chép", "Copy")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
