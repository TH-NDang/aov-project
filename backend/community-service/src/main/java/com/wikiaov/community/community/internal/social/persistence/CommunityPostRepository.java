package com.wikiaov.community.community.internal.social.persistence;

import com.wikiaov.community.community.internal.domain.PostStatus;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, UUID> {
    @Query("select p from CommunityPost p where p.pageId = :pageId and (p.status = PUBLISHED or (p.actor = :actor and p.status = DRAFT)) order by p.createdAt desc")
    org.springframework.data.domain.Page<CommunityPost> visibleTo(UUID pageId, String actor,
            org.springframework.data.domain.Pageable page);

    Page<CommunityPost> findByPageIdAndStatusOrderByCreatedAtDesc(UUID pageId, PostStatus status, Pageable pageable);

    /** A page's published posts with its pinned post first; {@code kind} null keeps every kind. */
    @Query("""
            select p from CommunityPost p where p.pageId = :pageId and p.status = PUBLISHED
            and (:kind is null or p.kind = :kind)
            order by case when p.pinnedAt is null then 1 else 0 end, p.createdAt desc
            """)
    Page<CommunityPost> pagePosts(UUID pageId, String kind, Pageable pageable);

    Optional<CommunityPost> findByPageIdAndPinnedAtIsNotNull(UUID pageId);

    @Query(value = "select count(*) from community.post where cast(image_urls as text) like concat('%/', :id, '/%')", nativeQuery = true)
    long countMedia(String id);

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
     * Published posts of published pages, newest first. {@code follower} limits them to that account's follows,
     * {@code kind} to one post kind and {@code pattern} (an escaped ILIKE pattern) to matching titles or text.
     */
    @Query(value = """
            SELECT p.* FROM community.post p JOIN community.page g ON g.id = p.page_id
            WHERE p.status = :status AND g.published_content IS NOT NULL AND g.kind <> 'CIRCUIT'
              AND (CAST(:follower AS varchar) IS NULL OR EXISTS (
                SELECT 1 FROM community.follow f WHERE f.page_id = p.page_id AND f.actor = :follower))
              AND (CAST(:kind AS varchar) IS NULL OR p.kind = :kind)
              AND (CAST(:pattern AS varchar) IS NULL OR p.body ILIKE :pattern ESCAPE '\\'
                OR p.title ILIKE :pattern ESCAPE '\\')
            ORDER BY p.created_at DESC, p.id
            """, countQuery = """
            SELECT count(*) FROM community.post p JOIN community.page g ON g.id = p.page_id
            WHERE p.status = :status AND g.published_content IS NOT NULL AND g.kind <> 'CIRCUIT'
              AND (CAST(:follower AS varchar) IS NULL OR EXISTS (
                SELECT 1 FROM community.follow f WHERE f.page_id = p.page_id AND f.actor = :follower))
              AND (CAST(:kind AS varchar) IS NULL OR p.kind = :kind)
              AND (CAST(:pattern AS varchar) IS NULL OR p.body ILIKE :pattern ESCAPE '\\'
                OR p.title ILIKE :pattern ESCAPE '\\')
            """, nativeQuery = true)
    Page<CommunityPost> published(String status, String follower, String kind, String pattern, Pageable pageable);
}
