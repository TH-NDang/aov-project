package com.wikiaov.community.community.internal.social.persistence;

import com.wikiaov.community.community.internal.domain.PostStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, UUID> {
    @Query("select p from CommunityPost p where p.pageId = :pageId and (p.status = PUBLISHED or (p.actor = :actor and p.status = DRAFT)) order by p.createdAt desc")
    Page<CommunityPost> visibleTo(UUID pageId, String actor,
            Pageable page);

    Page<CommunityPost> findByPageIdAndStatusOrderByCreatedAtDesc(UUID pageId, PostStatus status, Pageable pageable);

    /** A page's published posts with its pinned post first; {@code kind} null keeps every kind. */
    @Query("""
            select p from CommunityPost p where p.pageId = :pageId and p.status = PUBLISHED
            and (:kind is null or p.kind = :kind)
            order by case when p.pinnedAt is null then 1 else 0 end, p.createdAt desc
            """)
    Page<CommunityPost> pagePosts(UUID pageId, String kind, Pageable pageable);

    Optional<CommunityPost> findByPageIdAndPinnedAtIsNotNull(UUID pageId);

    /** Native: looks for the image path in the text of the jsonb image list. */
    @Query(value = "select count(*) from community.post where cast(image_urls as text) like concat('%/', :id, '/%')", nativeQuery = true)
    long countMedia(String id);

    /** Native: finds image paths in the jsonb image lists with a PostgreSQL regular expression. */
    @Query(value = """
        SELECT pairs.asset FROM (
        SELECT DISTINCT found.owner, lower(m[2]) AS asset FROM (
            SELECT id AS owner, image_urls AS body FROM community.post
        ) found, LATERAL regexp_matches(CAST(found.body AS text), '/(assets|media)/([0-9a-fA-F-]{36})/', 'g') m
        ) pairs
        """, nativeQuery = true)
    List<String> allMedia();

    @Query("select p from CommunityPost p where p.pageId = :pageId and (p.asPage = true or p.status <> DRAFT) order by p.createdAt desc")
    Page<CommunityPost> findByPageIdOrderByCreatedAtDesc(UUID pageId, Pageable pageable);

    /**
     * Published posts of published pages, newest first; circuits have none. {@code follower} limits them to that
     * account's follows, {@code kind} to one post kind and {@code pattern} (an escaped ILIKE pattern) to matching
     * titles or text.
     */
    @Query("""
            select p from CommunityPost p join PageRecord g on g.id = p.pageId
            where p.status = PUBLISHED and g.publishedContent is not null and g.kind <> CIRCUIT
              and (:follower is null or exists (
                select 1 from PageFollow f where f.pageId = p.pageId and f.actor = :follower))
              and (:kind is null or p.kind = :kind)
              and (:pattern is null or p.body ilike :pattern escape '\\' or p.title ilike :pattern escape '\\')
            order by p.createdAt desc, p.id
            """)
    Page<CommunityPost> published(@Nullable String follower, @Nullable String kind, @Nullable String pattern,
            Pageable pageable);
}
