import { useState } from "react"
import { Link, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { profileKindLabels, type CommunityProfile, type PageViewer } from "@aov/community-contracts"
import { StreamShell } from "../../../components/stream-shell"
import { StreamIcon } from "../../../components/stream-icon"
import { useStreamLocale } from "../../../components/stream-locale"
import { communityApi } from "../../../lib/community-api"
import { communityKeys } from "../../../lib/community-keys"
import { useCommunitySession } from "../../../lib/stream-auth"
import { CommunityFeed } from "../components/community-feed"
import { Avatar, profileKindEnglish } from "../../../components/community-ui"
import { PageMembers, roleLabels } from "../components/page-members"
import { PagePresentationForm } from "../components/page-presentation-form"
import { SignInPrompt } from "../components/sign-in-prompt"

/** `/manage/:id`: where the representatives of a page edit it, post as it and manage who helps them. */
export function CommunityPageManager() {
  const { text } = useStreamLocale()
  const { id = "" } = useParams()
  const session = useCommunitySession()
  const enabled = session.status === "authenticated"
  const profile = useQuery({
    queryKey: communityKeys.managedPage(session.revision, id),
    queryFn: () => communityApi.managedPage(id),
    enabled,
  })
  const viewer = useQuery({
    queryKey: communityKeys.viewer(session.revision, id),
    queryFn: () => communityApi.viewer(id),
    enabled,
  })
  return (
    <StreamShell>
      <div className="cp-container">
        {session.status === "loading" ? (
          <ManagerSkeleton />
        ) : !enabled ? (
          <>
            <title>{text("Quản lý trang — AOV Stream", "Manage page — AOV Stream")}</title>
            <header className="tn-page-head">
              <div>
                <h1>{text("Quản lý trang", "Manage page")}</h1>
                <p>
                  {text(
                    "Người đại diện cập nhật giới thiệu, đăng bài và mời người cùng quản lý trang.",
                    "Representatives update the introduction, post and invite others to manage the page.",
                  )}
                </p>
              </div>
            </header>
            <SignInPrompt title={text("Đăng nhập để quản lý trang", "Sign in to manage the page")} />
          </>
        ) : profile.isError || viewer.isError ? (
          <p className="cp-error" role="alert">
            {profile.error?.message || viewer.error?.message}
          </p>
        ) : !profile.data || !viewer.data ? (
          <ManagerSkeleton />
        ) : !viewer.data.role ? (
          <div className="hub-state">
            <h2>{text("Bạn chưa có quyền quản lý trang này.", "You are not allowed to manage this page yet.")}</h2>
            <p>
              {text(
                "Trang bạn quản lý được liệt kê trong tài khoản, mục “Trang và yêu cầu”.",
                "The pages you manage are listed in your account, under “Pages and requests”.",
              )}
            </p>
            <div className="hub-state-actions">
              <Link className="cp-button" to="/account?tab=pages">
                {text("Về Trang & yêu cầu", "Back to Pages & requests")}
              </Link>
            </div>
          </div>
        ) : (
          <Manager key={`${id}:${viewer.data.version}`} profile={profile.data} viewer={viewer.data} />
        )}
      </div>
    </StreamShell>
  )
}

function ManagerSkeleton() {
  const { text } = useStreamLocale()
  return (
    <div className="cp-manage-skeleton" role="status" aria-label={text("Đang tải trang", "Loading page")}>
      <span className="hub-skeleton" />
      <span className="hub-skeleton" />
      <div className="hub-skeleton-rows" />
    </div>
  )
}

type ManagerTab = "presentation" | "posts" | "members"
const managerTabs: [ManagerTab, readonly [string, string]][] = [
  ["presentation", ["Giới thiệu", "About"]],
  ["posts", ["Bài viết", "Posts"]],
  ["members", ["Người quản lý", "Managers"]],
]

function Manager({ profile, viewer }: { profile: CommunityProfile; viewer: PageViewer }) {
  const { text } = useStreamLocale()
  const [tab, setTab] = useState<ManagerTab>("presentation")
  const name = profile.content?.name || profile.code
  return (
    <>
      <title>{text(`Quản lý ${name} — AOV Stream`, `Manage ${name} — AOV Stream`)}</title>
      <Link className="cp-back" to="/account?tab=pages">
        <StreamIcon name="back" size={16} />
        {text("Trang bạn quản lý", "Pages you manage")}
      </Link>
      <header className="tn-page-head cp-manage-head">
        <div className="cp-manage-identity">
          <Avatar profile={profile} />
          <div>
            <h1>{name}</h1>
            <p>
              {text(profileKindLabels[profile.kind], profileKindEnglish[profile.kind])} · {text("bạn là", "your role:")}{" "}
              {viewer.role ? text(...roleLabels[viewer.role]).toLowerCase() : ""}
            </p>
          </div>
        </div>
        <Link
          className="cp-button cp-manage-public"
          to={`/pages/${profile.code}`}
          aria-label={text("Xem trang công khai", "View public page")}
        >
          <span>{text("Xem trang công khai", "View public page")}</span>
          <StreamIcon name="arrow" size={15} />
        </Link>
      </header>
      <nav className="cp-tabs" aria-label={text("Mục quản lý", "Management sections")}>
        {managerTabs.map(([value, label]) => (
          <button key={value} aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)}>
            {text(...label)}
          </button>
        ))}
      </nav>
      {tab === "presentation" && <PagePresentationForm profile={profile} viewer={viewer} />}
      {tab === "posts" && (
        <section className="cp-section" aria-labelledby="manage-posts">
          <div className="tn-heading" data-flush="">
            <h2 id="manage-posts">{text("Bài viết của trang", "The page's posts")}</h2>
          </div>
          <CommunityFeed
            pageId={profile.id}
            pageName={name}
            role={viewer.role}
            represented={profile.represented}
            manage
          />
        </section>
      )}
      {tab === "members" && <PageMembers profile={profile} viewer={viewer} />}
    </>
  )
}
