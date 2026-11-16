import { Link } from "react-router"
import { profileKindLabels } from "@aov/community-contracts"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import owlMark from "../../assets/stream-owl.svg"
import { StreamIcon } from "../../components/stream-icon"
import { signIn, useCommunitySession } from "./community-auth"
import { useFollowedPages, useFollowPage, useSuggestions } from "./community-queries"
import { Avatar, followersLabel } from "./community-ui"

/**
 * The right column of the feed. Visitors get the invitation to sign in; signed-in readers get the pages they follow
 * and pages to follow next. The account and the notifications live in the top bar.
 */
export function CommunityAside() {
  const session = useCommunitySession()
  const signedIn = session.status === "authenticated"
  return (
    <>
      {!signedIn && <GuestCard />}
      {signedIn && <FollowingCard />}
      {signedIn && <FollowSuggestions />}
    </>
  )
}

function GuestCard() {
  return (
    <section className="hub-card hub-card-padded cp-join" aria-labelledby="join-title">
      <div className="cp-join-head">
        <img src={owlMark} alt="" width={32} height={32} />
        <h2 id="join-title">Tham gia cộng đồng</h2>
      </div>
      <p className="hub-card-text">
        Ai cũng đọc được bài viết. Đăng nhập để theo dõi trang, nhận thông báo, thích và bình luận.
      </p>
      <div className="cp-join-actions">
        <button className="cp-button cp-primary" onClick={() => void signIn()}>
          Đăng nhập
        </button>
        <button className="cp-button" onClick={() => void signIn(true)}>
          Tạo tài khoản
        </button>
      </div>
    </section>
  )
}

/** Quick access to the pages the viewer follows, as rows like the competitions above them. */
function FollowingCard() {
  const pages = useFollowedPages()
  const items = pages.data?.items || []
  if (!items.length) return null
  return (
    <section className="hub-card hub-card-padded" aria-labelledby="side-following">
      <div className="hub-card-heading">
        <h2 id="side-following" className="hub-card-title">
          Đang theo dõi
        </h2>
        <Link to="/account?tab=follows" className="hub-card-more">
          Xem tất cả
        </Link>
      </div>
      <ul className="tn-mini-list cp-page-rows">
        {items.slice(0, 6).map((profile) => (
          <li key={profile.id}>
            <Link to={`/pages/${profile.code}`}>
              <Avatar profile={profile} />
              <span>
                <strong>{profile.content?.name || profile.code}</strong>
                <small>
                  {profile.live ? <span className="tn-live">Trực tiếp</span> : profileKindLabels[profile.kind]}
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FollowSuggestions() {
  const pages = useSuggestions(5)
  const follow = useFollowPage()
  return (
    <section className="hub-card hub-card-padded hub-follow-suggestions" aria-labelledby="side-suggestions">
      <div className="hub-card-heading">
        <h2 id="side-suggestions" className="hub-card-title">
          Gợi ý theo dõi
        </h2>
        <Link to="/explore" className="hub-card-more">
          Xem tất cả
        </Link>
      </div>
      {pages.isPending && <div className="hub-skeleton-rows" role="status" aria-label="Đang tải gợi ý" />}
      {pages.isError && <p className="hub-card-text">Chưa tải được gợi ý.</p>}
      {pages.data && !pages.data.items.length && (
        <p className="hub-card-text">Bạn đã theo dõi mọi trang hiện có. Trang mới sẽ được gợi ý tại đây.</p>
      )}
      {!!pages.data?.items.length && (
        <ul className="tn-mini-list cp-page-rows">
          {pages.data.items.map((profile) => {
            const name = profile.content?.name || profile.code
            return (
              <li key={profile.id}>
                <Link to={`/pages/${profile.code}`}>
                  <Avatar profile={profile} />
                  <span>
                    <strong>
                      {name}
                      {profile.represented && <OfficialBadge label="Đại diện đã xác minh" />}
                    </strong>
                    <small>
                      {profileKindLabels[profile.kind]}
                      {profile.followers > 0 && ` · ${followersLabel(profile.followers)}`}
                    </small>
                  </span>
                </Link>
                <button
                  className="cp-follow-chip cp-follow-primary cp-follow-icon"
                  disabled={follow.isPending}
                  onClick={() => follow.mutate({ pageId: profile.id, following: true })}
                  aria-label={`Theo dõi ${name}`}
                  title={`Theo dõi ${name}`}
                >
                  <StreamIcon name="plus" size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {follow.isError && (
        <p className="cp-field-error" role="alert">
          {follow.error.message}
        </p>
      )}
    </section>
  )
}
