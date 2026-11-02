package com.wikiaov.community.community.internal.social.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, UUID> {
    @Query("select p from CommunityPost p where p.pageId = :pageId and (p.status = 'PUBLISHED' or (p.actor = :actor and p.status = 'DRAFT')) order by p.createdAt desc")
    org.springframework.data.domain.Page<CommunityPost> visibleTo(UUID pageId, String actor,
            org.springframework.data.domain.Pageable page);

    Page<CommunityPost> findByPageIdAndStatusOrderByCreatedAtDesc(UUID pageId, String status, Pageable pageable);

    @Query("select p from CommunityPost p where p.pageId = :pageId and (p.asPage = true or p.status <> 'DRAFT') order by p.createdAt desc")
    Page<CommunityPost> findByPageIdOrderByCreatedAtDesc(UUID pageId, Pageable pageable);

    /** Published posts of published pages, newest first; {@code follower} limits them to that account's follows. */
    @Query(value = """
            SELECT p.* FROM community.post p JOIN community.page g ON g.id = p.page_id
            WHERE p.status = 'PUBLISHED' AND g.published_content IS NOT NULL
              AND (CAST(:follower AS varchar) IS NULL OR EXISTS (
                SELECT 1 FROM community.follow f WHERE f.page_id = p.page_id AND f.actor = :follower))
            ORDER BY p.created_at DESC, p.id
            """, countQuery = """
            SELECT count(*) FROM community.post p JOIN community.page g ON g.id = p.page_id
            WHERE p.status = 'PUBLISHED' AND g.published_content IS NOT NULL
              AND (CAST(:follower AS varchar) IS NULL OR EXISTS (
                SELECT 1 FROM community.follow f WHERE f.page_id = p.page_id AND f.actor = :follower))
            """, nativeQuery = true)
    Page<CommunityPost> published(String follower, Pageable pageable);
}
