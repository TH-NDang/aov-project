package com.wikiaov.community.community.internal.application;

import com.wikiaov.community.community.internal.domain.PageContent;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Page;

public final class PageViews {
    private PageViews() {
    }

    public record Slice<T>(
            List<T> items,
            long totalElements,
            int page,
            int size
    ) {
        public static <T> Slice<T> of(Page<T> value) {
            return new Slice<>(value.getContent(), value.getTotalElements(), value.getNumber(), value.getSize());
        }
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
            Live live
    ) {
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

    public record Notification(
            UUID id,
            UUID pageId,
            String message,
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
