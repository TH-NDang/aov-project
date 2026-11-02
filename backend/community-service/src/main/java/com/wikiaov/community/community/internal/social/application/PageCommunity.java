package com.wikiaov.community.community.internal.social.application;

import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.domain.PageRules;
import com.wikiaov.community.community.internal.pages.application.*;
import com.wikiaov.community.community.internal.social.persistence.*;
import com.wikiaov.community.platform.CommunityActor;
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

    public PageCommunity(PageAccess access, CommunityPostRepository posts, CommunityCommentRepository comments,
            PageFollowRepository follows, PostLikeRepository likes, CommunityReportRepository reports,
            PageNotifications notifications) {
        this.access = access;
        this.posts = posts;
        this.comments = comments;
        this.follows = follows;
        this.likes = likes;
        this.reports = reports;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public Slice<Post> posts(UUID pageId, int page, int size, boolean manage) {
        if (manage)
            access.require(pageId, CommunityActor.require(), "OWNER", "EDITOR", "MODERATOR");
        else
            access.published(pageId);
        var result = manage
                ? posts.findByPageIdOrderByCreatedAtDesc(pageId, PageProfiles.paging(page, size))
                : posts.findByPageIdAndStatusOrderByCreatedAtDesc(pageId, "PUBLISHED", PageProfiles.paging(page, size));
        var actor = manage ? CommunityActor.require() : null;
        return Slice.of(views(result, actor));
    }

    @Transactional(readOnly = true)
    public Slice<Post> feed(UUID pageId, int page, int size) {
        var actor = CommunityActor.require();
        access.published(pageId);
        return Slice.of(views(posts.visibleTo(pageId, actor.key(), PageProfiles.paging(page, size)), actor));
    }

    public Post write(UUID pageId, UUID id, Long version, String body, boolean asPage, boolean publish) {
        var actor = CommunityActor.require();
        PageRules.text(body, 20000, true);
        access.lock(pageId);
        var profile = access.published(pageId);
        if (asPage)
            access.require(pageId, actor, "OWNER", "EDITOR");
        var row = id == null ? new CommunityPost() : posts.findById(id).orElseThrow(PageAccess::missing);
        if (id != null) {
            if (!pageId.equals(row.getPageId()))
                throw PageAccess.missing();
            if (!row.getAsPage() && !row.getActor().equals(actor.key()))
                throw PageAccess.forbidden();
            PageAccess.version(row.getVersion(), version);
            if (row.getAsPage() != asPage)
                throw PageRules.invalid("A post's author identity cannot change.");
            if (row.getStatus().equals("HIDDEN"))
                throw PageRules.invalid("A moderated post cannot be republished by its author.");
        } else {
            row.setPageId(pageId);
            row.setActor(actor.key());
            row.setCreatedAt(Instant.now());
            row.setAsPage(asPage);
            row.setAuthorName(asPage ? profile.getPublishedContent().name() : actor.name());
        }
        boolean newlyPublished = publish && !"PUBLISHED".equals(row.getStatus());
        row.setBody(body.strip());
        row.setStatus(publish ? "PUBLISHED" : "DRAFT");
        row.setUpdatedAt(Instant.now());
        posts.saveAndFlush(row);
        access.audit(pageId, actor, "PAGE_POST_SAVED");
        if (newlyPublished && asPage)
            notifyFollowers(pageId, profile.getPublishedContent().name() + " vừa đăng bài mới.");
        return postView(row, actor, likes.countByPostId(row.getId()),
                likes.existsByPostIdAndActor(row.getId(), actor.key()));
    }

    @Transactional(readOnly = true)
    public Slice<Comment> comments(UUID postId, int page, int size) {
        publishedPost(postId);
        return Slice.of(comments.findByPostIdAndHiddenFalseOrderByCreatedAtAsc(postId, PageProfiles.paging(page, size))
                .map(row -> new Comment(row.getId(), postId, row.getAuthorName(), row.getAsPage(), row.getBody(),
                        row.getCreatedAt(), false)));
    }

    public Comment comment(UUID postId, String body, boolean asPage) {
        var actor = CommunityActor.require();
        PageRules.text(body, 4000, true);
        var post = publishedPost(postId);
        access.lock(post.getPageId());
        if (asPage)
            access.require(post.getPageId(), actor, "OWNER", "EDITOR", "MODERATOR");
        var row = new CommunityComment();
        row.setPostId(postId);
        row.setActor(actor.key());
        row.setBody(body.strip());
        row.setAsPage(asPage);
        row.setCreatedAt(Instant.now());
        row.setAuthorName(asPage ? access.published(post.getPageId()).getPublishedContent().name() : actor.name());
        comments.saveAndFlush(row);
        if (!post.getActor().equals(actor.key()))
            notifications.send(post.getActor(), post.getPageId(), "Bài viết của bạn có bình luận mới.");
        access.audit(post.getPageId(), actor, "PAGE_COMMENT_ADDED");
        return new Comment(row.getId(), postId, row.getAuthorName(), asPage, body, row.getCreatedAt(), true);
    }

    public void follow(UUID pageId, boolean following) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        access.published(pageId);
        var previous = follows.findByPageIdAndActor(pageId, actor.key());
        if (following && previous.isEmpty()) {
            var row = new PageFollow();
            row.setActor(actor.key());
            row.setPageId(pageId);
            follows.save(row);
        } else if (!following)
            previous.ifPresent(follows::delete);
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
        PageRules.text(reason, 2000, true);
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
    public Slice<Report> reports(int page, int size) {
        return Slice.of(reports.findByResolvedFalseOrderByCreatedAtAsc(PageProfiles.paging(page, size))
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
            throw PageRules.invalid("Choose a post.");
        var post = posts.findById(postId).orElseThrow(PageAccess::missing);
        if (!post.getPageId().equals(pageId))
            throw PageAccess.missing();
        if (commentId != null) {
            var comment = comments.findById(commentId).orElseThrow(PageAccess::missing);
            if (!comment.getPostId().equals(postId))
                throw PageAccess.missing();
            comment.setHidden(hidden);
        } else {
            if (post.getStatus().equals("DRAFT"))
                throw PageRules.invalid("Drafts cannot be published by moderation.");
            post.setStatus(hidden ? "HIDDEN" : "PUBLISHED");
        }
        access.audit(pageId, actor, hidden ? "PAGE_CONTENT_HIDDEN" : "PAGE_CONTENT_RESTORED");
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    public void resolve(UUID id, String resolution, boolean hide) {
        PageRules.text(resolution, 2000, true);
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
            access.require(pageId, actor, "OWNER", "MODERATOR");
    }

    private CommunityPost publishedPost(UUID id) {
        var post = posts.findById(id).orElseThrow(PageAccess::missing);
        access.published(post.getPageId());
        if (!post.getStatus().equals("PUBLISHED"))
            throw PageAccess.missing();
        return post;
    }

    /** Counts likes for a whole page of posts in two queries; {@code actor} is null for anonymous readers. */
    private org.springframework.data.domain.Page<Post> views(org.springframework.data.domain.Page<CommunityPost> rows,
            CommunityActor actor) {
        var ids = rows.map(CommunityPost::getId).getContent();
        var counts = new HashMap<UUID, Long>();
        var liked = new HashSet<UUID>();
        if (!ids.isEmpty()) {
            likes.countByPosts(ids).forEach(count -> counts.put(count.getPostId(), count.getLikes()));
            if (actor != null)
                liked.addAll(likes.likedBy(actor.key(), ids));
        }

        return rows.map(row -> postView(row, actor, counts.getOrDefault(row.getId(), 0L), liked.contains(row.getId())));
    }

    private Post postView(CommunityPost row, CommunityActor actor, long likeCount, boolean liked) {
        return new Post(row.getId(), row.getVersion(), row.getPageId(), row.getAuthorName(), row.getAsPage(),
                row.getBody(), row.getStatus(), row.getCreatedAt(),
                actor != null && actor.key().equals(row.getActor()), likeCount, liked);
    }

    private void notifyFollowers(UUID pageId, String message) {
        int page = 0;
        org.springframework.data.domain.Page<PageFollow> batch;
        do {
            batch = follows.findByPageId(pageId, PageProfiles.paging(page++, 100));
            batch.forEach(row -> notifications.send(row.getActor(), pageId, message));
        } while (batch.hasNext());
    }
}
