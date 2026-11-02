import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CommunityPost, PageSlice, PageRole } from "@aov/community-contracts"
import { StreamIcon } from "../../components/stream-icon"
import { communityApi } from "./community-api"
import { useCommunitySession } from "./community-auth"
import { PostCard } from "./community-post"
import { useSignedInAction } from "./community-signin"

/** The posts of one page with a composer; anonymous readers see the published posts and an invitation to sign in. */
export function CommunityFeed({
  pageId,
  pageName,
  role,
  manage = false,
  represented = false,
}: {
  pageId: string
  pageName: string
  role: PageRole | ""
  manage?: boolean
  /** Posts made as a page with a verified representative carry the official badge. */
  represented?: boolean
}) {
  const session = useCommunitySession()
  const signedIn = useSignedInAction()
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [body, setBody] = useState("")
  const [asPage, setAsPage] = useState(manage && ["OWNER", "EDITOR"].includes(role))
  const posts = useQuery({
    queryKey: ["page-posts", session.revision, pageId, page, manage],
    queryFn: () =>
      communityApi<PageSlice<CommunityPost>>(
        `${manage || session.status === "authenticated" ? "/me" : ""}/pages/${pageId}/${!manage && session.status === "authenticated" ? "feed" : "posts"}?page=${page}&size=20`,
      ),
  })
  const write = useMutation({
    mutationFn: (publish: boolean) => communityApi(`/me/pages/${pageId}/posts`, { body, asPage, publish }),
    onSuccess: async () => {
      setBody("")
      setPage(0)
      await client.invalidateQueries({ queryKey: ["page-posts"] })
      await client.invalidateQueries({ queryKey: ["community-feed"] })
    },
  })
  return (
    <div className="cp-feed">
      <section className="cp-panel cp-composer">
        {session.status !== "authenticated" ? (
          <button
            className="cp-composer-guest"
            onClick={() => signedIn(`Đăng nhập để đăng bài và thảo luận trên trang ${pageName}.`, () => undefined)}
          >
            <span className="hub-link-icon" aria-hidden="true">
              <StreamIcon name="edit" size={18} />
            </span>
            <span>Chia sẻ suy nghĩ của bạn về {pageName}…</span>
            <span className="cp-button cp-primary">Đăng nhập để viết</span>
          </button>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              write.mutate(true)
            }}
          >
            <label>
              <span className="sr-only">Chia sẻ với cộng đồng</span>
              <textarea
                required
                rows={3}
                maxLength={20000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={`Chia sẻ suy nghĩ của bạn về ${pageName}…`}
              />
            </label>
            <div className="cp-actions cp-composer-actions">
              <label className="cp-inline-label">
                Đăng với tư cách
                <select value={asPage ? "page" : "self"} onChange={(event) => setAsPage(event.target.value === "page")}>
                  <option value="self">{session.name}</option>
                  {["OWNER", "EDITOR"].includes(role) && <option value="page">{pageName}</option>}
                </select>
              </label>
              <button
                type="button"
                className="cp-button"
                disabled={write.isPending || !body.trim()}
                onClick={() => write.mutate(false)}
              >
                Lưu nháp
              </button>
              <button className="cp-button cp-primary" disabled={write.isPending}>
                <StreamIcon name="send" size={16} />
                Đăng bài
              </button>
            </div>
            {write.isError && (
              <p role="alert" className="cp-error">
                {write.error.message}
              </p>
            )}
          </form>
        )}
      </section>
      {posts.isPending ? (
        <div className="hub-skeleton-rows" role="status" aria-label="Đang tải bài viết" />
      ) : posts.isError ? (
        <div className="hub-state" role="alert">
          <StreamIcon name="reset" size={28} />
          <h3>{posts.error.message}</h3>
          <button className="cp-button" onClick={() => void posts.refetch()}>
            Thử lại
          </button>
        </div>
      ) : !posts.data.items.length ? (
        <div className="hub-state">
          <StreamIcon name="message" size={28} />
          <h3>Chưa có bài viết</h3>
          <p>Thông tin hồ sơ vẫn được cập nhật ở các mục khác của trang.</p>
        </div>
      ) : (
        <div className="cp-post-list">
          {posts.data.items.map((post) => (
            <PostCard key={post.id} post={post} role={role} represented={represented} />
          ))}
        </div>
      )}
      {posts.data && posts.data.totalElements > 20 && (
        <div className="hub-pagination">
          <button className="cp-button" disabled={!page} onClick={() => setPage(page - 1)}>
            Trước
          </button>
          <span>Trang {page + 1}</span>
          <button
            className="cp-button"
            disabled={(page + 1) * 20 >= posts.data.totalElements}
            onClick={() => setPage(page + 1)}
          >
            Tiếp
          </button>
        </div>
      )}
    </div>
  )
}
