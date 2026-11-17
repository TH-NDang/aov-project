package com.wikiaov.community.community.internal.social.application;

import com.wikiaov.community.community.internal.application.PageChecks;
import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.domain.PageContent.Role;
import com.wikiaov.community.community.internal.domain.PostContent;
import com.wikiaov.community.community.internal.domain.PostStatus;
import com.wikiaov.community.community.internal.pages.application.*;
import com.wikiaov.community.community.internal.social.persistence.*;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.CompetitionAssets;
import java.time.Instant;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PageCommunity {
    private final PageAccess access;
    private final CommunityPostRepository posts;
    private final CommunityCommentRepository comments;
    private final PageFollowRepository follows;
    private final PostLikeRepository likes;
    private final CommunityReportRepository reports;
    private final PageNotifications notifications;
    private final PageProfiles profiles;
    private final CompetitionAssets assets;

    public PageCommunity(PageAccess access, CommunityPostRepository posts, CommunityCommentRepository comments,
            PageFollowRepository follows, PostLikeRepository likes, CommunityReportRepository reports,
            PageNotifications notifications, PageProfiles profiles, CompetitionAssets assets) {
        this.access = access;
        this.posts = posts;
        this.comments = comments;
        this.follows = follows;
        this.likes = likes;
        this.reports = reports;
        this.notifications = notifications;
        this.profiles = profiles;
        this.assets = assets;
    }

    @Transactional(readOnly = true)
    public PageSlice<Post> posts(UUID pageId, String kind, int page, int size, boolean manage) {
        var filter = PageChecks.postKindFilter(kind);
        if (manage)
            access.require(pageId, CommunityActor.require(), Role.OWNER, Role.EDITOR, Role.MODERATOR);
        else
            access.social(pageId);
        var result = manage
                ? posts.findByPageIdOrderByCreatedAtDesc(pageId, PageProfiles.paging(page, size))
                : posts.pagePosts(pageId, filter, PageProfiles.paging(page, size));
        var actor = manage ? CommunityActor.require() : null;
        return PageSlice.from(views(result, actor));
    }

    @Transactional(readOnly = true)
    public PageSlice<Post> feed(UUID pageId, int page, int size) {
        var actor = CommunityActor.require();
        access.social(pageId);
        return PageSlice.from(views(posts.visibleTo(pageId, actor.key(), PageProfiles.paging(page, size)), actor));
    }

    /** The public feed across published pages; anonymous readers never see their own likes. */
    @Transactional(readOnly = true)
    public PageSlice<FeedPost> latest(String kind, String query, int page, int size) {
        var filter = PageChecks.postKindFilter(kind);
        var pattern = PageChecks.searchPattern(query);
        return feedView(
                posts.published(PostStatus.PUBLISHED.name(), null, filter, pattern, PageProfiles.paging(page, size)),
                null);
    }

    @Transactional(readOnly = true)
    public PageSlice<FeedPost> timeline(boolean following, String kind, int page, int size) {
        var actor = CommunityActor.require();
        var filter = PageChecks.postKindFilter(kind);
        return feedView(
                posts.published(PostStatus.PUBLISHED.name(), following ? actor.key() : null, filter, null,
                        PageProfiles.paging(page, size)),
                actor);
    }

    public Post write(UUID pageId, UUID id, Long version, PostContent input, boolean asPage, boolean publish) {
        var actor = CommunityActor.require();
        var content = PageChecks.post(input);
        assets.acquire(content.imageUrls().toArray(String[]::new));
        access.lock(pageId);
        var profile = access.social(pageId);
        if (asPage)
            access.require(pageId, actor, Role.OWNER, Role.EDITOR);
        var row = id == null ? new CommunityPost() : posts.findById(id).orElseThrow(PageAccess::missing);
        if (id != null) {
            if (!pageId.equals(row.getPageId()))
                throw PageAccess.missing();
            if (!row.getAsPage() && !row.getActor().equals(actor.key()))
                throw PageAccess.forbidden();
            PageAccess.version(row.getVersion(), version);
            if (row.getAsPage() != asPage)
                throw PageChecks.invalid("A post's author identity cannot change.");
            if (row.getStatus() == PostStatus.HIDDEN)
                throw PageChecks.invalid("A moderated post cannot be republished by its author.");
        } else {
            row.setPageId(pageId);
            row.setActor(actor.key());
            row.setCreatedAt(Instant.now());
            row.setAsPage(asPage);
            row.setAuthorName(asPage ? profile.getPublishedContent().name() : actor.name());
        }
        boolean newlyPublished = publish && row.getStatus() != PostStatus.PUBLISHED;
        row.setKind(content.kind());
        row.setTitle(content.title());
        row.setBody(content.body());
        row.setVideoUrl(content.videoUrl());
        row.setImageUrls(content.imageUrls());
        row.setStatus(publish ? PostStatus.PUBLISHED : PostStatus.DRAFT);
        if (!publish)
            row.setPinnedAt(null);
        row.setUpdatedAt(Instant.now());
        posts.saveAndFlush(row);
        access.audit(pageId, actor, "PAGE_POST_SAVED");
        if (newlyPublished && asPage)
            notifications.followers(pageId, profile.getPublishedContent().name() + " vừa đăng bài mới.");
        return postView(row, actor, likes.countByPostId(row.getId()),
                likes.existsByPostIdAndActor(row.getId(), actor.key()),
                comments.countByPostIdAndHiddenFalse(row.getId()));
    }

    @Transactional(readOnly = true)
    public PageSlice<Comment> comments(UUID postId, int page, int size) {
        publishedPost(postId);
        return PageSlice
                .from(comments.findByPostIdAndHiddenFalseOrderByCreatedAtAsc(postId, PageProfiles.paging(page, size))
                        .map(row -> new Comment(row.getId(), postId, row.getAuthorName(), row.getAsPage(),
                                row.getBody(),
                                row.getCreatedAt(), false)));
    }

    public Comment comment(UUID postId, String body, boolean asPage) {
        var actor = CommunityActor.require();
        PageChecks.text(body, 4000, true);
        var post = publishedPost(postId);
        access.lock(post.getPageId());
        if (asPage)
            access.require(post.getPageId(), actor, Role.OWNER, Role.EDITOR, Role.MODERATOR);
        var row = new CommunityComment();
        row.setPostId(postId);
        row.setActor(actor.key());
        row.setBody(body.strip());
        row.setAsPage(asPage);
        row.setCreatedAt(Instant.now());
        row.setAuthorName(asPage ? access.social(post.getPageId()).getPublishedContent().name() : actor.name());
        comments.saveAndFlush(row);
        if (!post.getActor().equals(actor.key()))
            notifications.send(post.getActor(), post.getPageId(), "Bài viết của bạn có bình luận mới.");
        access.audit(post.getPageId(), actor, "PAGE_COMMENT_ADDED");
        return new Comment(row.getId(), postId, row.getAuthorName(), asPage, body, row.getCreatedAt(), true);
    }

    public void follow(UUID pageId, boolean following) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        var page = access.published(pageId);
        if (following)
            PageAccess.requireCommunity(page);
        var previous = follows.findByPageIdAndActor(pageId, actor.key());
        if (following && previous.isEmpty()) {
            var row = new PageFollow();
            row.setActor(actor.key());
            row.setPageId(pageId);
            follows.save(row);
        } else if (!following)
            previous.ifPresent(follows::delete);
    }

    /** Pins a published page post; the page's previously pinned post loses its pin. */
    public Post pin(UUID pageId, UUID postId, boolean pinned) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        if (!actor.editor())
            access.require(pageId, actor, Role.OWNER, Role.EDITOR);
        var post = posts.findById(postId).orElseThrow(PageAccess::missing);
        if (!post.getPageId().equals(pageId))
            throw PageAccess.missing();
        if (pinned && (!post.getAsPage() || post.getStatus() != PostStatus.PUBLISHED))
            throw PageChecks.invalid("Only published page posts can be pinned.");

        if (pinned)
            posts.findByPageIdAndPinnedAtIsNotNull(pageId).filter(other -> !other.getId().equals(postId))
                    .ifPresent(other -> {
                        other.setPinnedAt(null);
                        posts.saveAndFlush(other);
                    });
        post.setPinnedAt(pinned ? Instant.now() : null);
        posts.saveAndFlush(post);
        access.audit(pageId, actor, pinned ? "PAGE_POST_PINNED" : "PAGE_POST_UNPINNED");

        return postView(post, actor, likes.countByPostId(postId), likes.existsByPostIdAndActor(postId, actor.key()),
                comments.countByPostIdAndHiddenFalse(postId));
    }

    public Liking like(UUID postId, boolean liked) {
        var actor = CommunityActor.require();
        publishedPost(postId);

        if (liked)
            likes.like(UUID.randomUUID(), postId, actor.key());
        else
            likes.unlike(postId, actor.key());
        return new Liking(liked, likes.countByPostId(postId));
    }

    public void report(UUID pageId, UUID postId, UUID commentId, String reason) {
        var actor = CommunityActor.require();
        PageChecks.text(reason, 2000, true);
        access.published(pageId);
        if (postId != null && !publishedPost(postId).getPageId().equals(pageId))
            throw PageAccess.missing();
        if (commentId != null) {
            var comment = comments.findById(commentId).orElseThrow(PageAccess::missing);
            if (!comment.getPostId().equals(postId) || comment.getHidden())
                throw PageAccess.missing();
        }
        var row = new CommunityReport();
        row.setPageId(pageId);
        row.setPostId(postId);
        row.setCommentId(commentId);
        row.setActor(actor.key());
        row.setReason(reason);
        row.setCreatedAt(Instant.now());
        reports.save(row);
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Report> reports(int page, int size) {
        return PageSlice.from(reports.findByResolvedFalseOrderByCreatedAtAsc(PageProfiles.paging(page, size))
                .map(row -> new Report(row.getId(), row.getPageId(), row.getPostId(), row.getCommentId(),
                        row.getReason(),
                        row.getCommentId() != null
                                ? comments.findById(row.getCommentId()).map(CommunityComment::getBody).orElse("")
                                : row.getPostId() != null
                                        ? posts.findById(row.getPostId()).map(CommunityPost::getBody).orElse("")
                                        : "",
                        row.getCreatedAt())));
    }

    public void hide(UUID pageId, UUID postId, UUID commentId, boolean hidden) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        moderate(pageId, actor);
        if (postId == null)
            throw PageChecks.invalid("Choose a post.");
        var post = posts.findById(postId).orElseThrow(PageAccess::missing);
        if (!post.getPageId().equals(pageId))
            throw PageAccess.missing();
        if (commentId != null) {
            var comment = comments.findById(commentId).orElseThrow(PageAccess::missing);
            if (!comment.getPostId().equals(postId))
                throw PageAccess.missing();
            comment.setHidden(hidden);
        } else {
            if (post.getStatus() == PostStatus.DRAFT)
                throw PageChecks.invalid("Drafts cannot be published by moderation.");
            post.setStatus(hidden ? PostStatus.HIDDEN : PostStatus.PUBLISHED);
            if (hidden)
                post.setPinnedAt(null);
        }
        access.audit(pageId, actor, hidden ? "PAGE_CONTENT_HIDDEN" : "PAGE_CONTENT_RESTORED");
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public void resolve(UUID id, String resolution, boolean hide) {
        PageChecks.text(resolution, 2000, true);
        var row = reports.findById(id).orElseThrow(PageAccess::missing);
        access.lock(row.getPageId());
        if (hide && row.getPostId() != null)
            hide(row.getPageId(), row.getPostId(), row.getCommentId(), true);
        row.setResolved(true);
        row.setResolution(resolution);
        access.audit(row.getPageId(), CommunityActor.require(), "PAGE_REPORT_RESOLVED");
        notifications.send(row.getActor(), row.getPageId(), "Báo cáo của bạn đã được xử lý.");
    }

    private void moderate(UUID pageId, CommunityActor actor) {
        if (!actor.publisher())
            access.require(pageId, actor, Role.OWNER, Role.MODERATOR);
    }

    private CommunityPost publishedPost(UUID id) {
        var post = posts.findById(id).orElseThrow(PageAccess::missing);
        access.social(post.getPageId());
        if (post.getStatus() != PostStatus.PUBLISHED)
            throw PageAccess.missing();
        return post;
    }

    /**
     * Counts likes and visible comments for a whole page of posts in batch queries; {@code actor} is null for
     * anonymous readers.
     */
    private org.springframework.data.domain.Page<Post> views(org.springframework.data.domain.Page<CommunityPost> rows,
            CommunityActor actor) {
        var ids = rows.map(CommunityPost::getId).getContent();
        var likeCounts = new HashMap<UUID, Long>();
        var commentCounts = new HashMap<UUID, Long>();
        var liked = new HashSet<UUID>();
        if (!ids.isEmpty()) {
            likes.countByPosts(ids).forEach(count -> likeCounts.put(count.getPostId(), count.getLikes()));
            comments.countByPosts(ids).forEach(count -> commentCounts.put(count.getPostId(), count.getComments()));
            if (actor != null)
                liked.addAll(likes.likedBy(actor.key(), ids));
        }

        return rows.map(row -> postView(row, actor, likeCounts.getOrDefault(row.getId(), 0L),
                liked.contains(row.getId()), commentCounts.getOrDefault(row.getId(), 0L)));
    }

    /** Feed rows whose page was withdrawn between the two reads are dropped from the slice. */
    private PageSlice<FeedPost> feedView(org.springframework.data.domain.Page<CommunityPost> rows,
            CommunityActor actor) {
        var cards = profiles.cards(rows.map(CommunityPost::getPageId).toSet());
        var items = views(rows, actor).getContent().stream().filter(post -> cards.containsKey(post.pageId()))
                .map(post -> new FeedPost(post, cards.get(post.pageId()))).toList();

        return new PageSlice<>(items, rows.getNumber(), rows.getSize(), rows.getTotalElements());
    }

    private Post postView(CommunityPost row, CommunityActor actor, long likeCount, boolean liked, long commentCount) {
        return new Post(row.getId(), row.getVersion(), row.getPageId(), row.getAuthorName(), row.getAsPage(),
                row.getBody(), row.getStatus().name(), row.getCreatedAt(),
                actor != null && actor.key().equals(row.getActor()), likeCount, liked, commentCount, row.getKind(),
                row.getTitle(), row.getVideoUrl(), List.copyOf(row.getImageUrls()), row.getPinnedAt() != null);
    }
}
