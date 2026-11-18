package com.wikiaov.community.community.internal.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.community.community.internal.domain.NotificationKind;
import com.wikiaov.community.community.internal.domain.PageContent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public final class PageViews {
    private PageViews() {
    }

    public record Profile(
            UUID id,
            Long version,
            String code,
            String kind,
            UUID entityId,
            PageContent content,
            boolean published,
            boolean represented,
            long followers,
            Instant updatedAt,
            Live live,
            @JsonInclude(JsonInclude.Include.NON_NULL) LocalDate lastActiveOn,
            @JsonInclude(JsonInclude.Include.NON_NULL) Boolean related
    ) {
        public Profile(UUID id, Long version, String code, String kind, UUID entityId, PageContent content,
                boolean published, boolean represented, long followers, Instant updatedAt, Live live) {
            this(id, version, code, kind, entityId, content, published, represented, followers, updatedAt, live, null,
                    null);
        }

        /** The same page with what explains its place in a list ordered by activity; only admin lists fill these. */
        public Profile ranked(LocalDate activeOn, Boolean relatedToContext) {
            return new Profile(id, version, code, kind, entityId, content, published, represented, followers, updatedAt,
                    live, activeOn, relatedToContext);
        }
    }

    /** A running broadcast; absent when the page is not live or the last one is older than the live window. */
    public record Live(
            String url,
            String title,
            Instant startedAt
    ) {
    }

    public record Claim(
            UUID id,
            long version,
            UUID pageId,
            String pageName,
            String name,
            String evidence,
            String status,
            String resolution,
            Instant createdAt
    ) {
    }

    public record TeamAffiliation(
            UUID teamPageId,
            String teamCode,
            String teamName,
            String teamAvatarUrl,
            PageContent.Member member
    ) {
    }

    public record Member(
            UUID id,
            String name,
            String role,
            boolean self
    ) {
    }

    /** Whether an unused owner handover code is still valid; the code itself is shown only when issued. */
    public record Handover(
            boolean pending,
            Instant expiresAt
    ) {
    }

    public record Post(
            UUID id,
            long version,
            UUID pageId,
            String authorName,
            boolean asPage,
            String body,
            String status,
            Instant createdAt,
            boolean own,
            long likes,
            boolean liked,
            long comments,
            String kind,
            String title,
            String videoUrl,
            List<String> imageUrls,
            boolean pinned
    ) {
    }

    /** The published page a feed post belongs to; the avatar follows the representative's presentation. */
    public record PageCard(
            UUID id,
            String code,
            String kind,
            String name,
            String avatarUrl,
            boolean represented
    ) {
    }

    public record FeedPost(
            Post post,
            PageCard page
    ) {
    }

    public record UnreadCount(
            long unread
    ) {
    }

    public record Liking(
            boolean liked,
            long likes
    ) {
    }

    public record Comment(
            UUID id,
            UUID postId,
            String authorName,
            boolean asPage,
            String body,
            Instant createdAt,
            boolean own
    ) {
    }

    /**
     * An inbox line. The reader's app words {@code kind} with {@code parameters}; a line sent before kinds existed has
     * no kind and carries its stored {@code message} instead.
     */
    public record Notification(
            UUID id,
            UUID pageId,
            @Nullable NotificationKind kind,
            Map<String, String> parameters,
            @JsonInclude(JsonInclude.Include.NON_NULL) @Nullable String message,
            Instant createdAt,
            boolean read
    ) {
    }

    public record Report(
            UUID id,
            UUID pageId,
            UUID postId,
            UUID commentId,
            String reason,
            String reportedContent,
            Instant createdAt
    ) {
    }
}
