package com.wikiaov.community.community.internal.pages.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageRepository extends JpaRepository<PageRecord, UUID> {

    @Query(value = """
        SELECT * FROM community.page
        WHERE (:kind IS NULL OR kind = :kind) AND (:published = false OR published_content IS NOT NULL)
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR
            lower((CASE WHEN :published THEN published_content ELSE content END)->>'name') LIKE lower(concat('%', :query, '%')))
        ORDER BY updated_at DESC, id
        """, countQuery = """
        SELECT count(*) FROM community.page
        WHERE (:kind IS NULL OR kind = :kind) AND (:published = false OR published_content IS NOT NULL)
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR
            lower((CASE WHEN :published THEN published_content ELSE content END)->>'name') LIKE lower(concat('%', :query, '%')))
        """, nativeQuery = true)
    Page<PageRecord> search(String kind, String query, boolean published, Pageable pageable);

    Optional<PageRecord> findByCode(String code);

    Optional<PageRecord> findByKindAndEntityId(String kind, UUID entityId);

    long countByKindAndEntityId(String kind, UUID entityId);

    @Query(value = "select count(*) from community.page where cast(content as text) like concat('%/', :id, '/%') or cast(published_content as text) like concat('%/', :id, '/%') or cast(presentation as text) like concat('%/', :id, '/%')", nativeQuery = true)
    long countMedia(String id);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PageRecord p where p.id = :id")
    Optional<PageRecord> lock(UUID id);

    /** Representatives, requests and community activity that keep a page from being deleted. */
    @Query(value = """
        SELECT (SELECT count(*) FROM community.page_member WHERE page_id = :id)
             + (SELECT count(*) FROM community.page_claim WHERE page_id = :id)
             + (SELECT count(*) FROM community.page_invitation WHERE page_id = :id)
             + (SELECT count(*) FROM community.post WHERE page_id = :id)
             + (SELECT count(*) FROM community.follow WHERE page_id = :id)
             + (SELECT count(*) FROM community.report WHERE page_id = :id)
             + (SELECT count(*) FROM community.notification WHERE page_id = :id)
        """, nativeQuery = true)
    long countActivity(UUID id);
}
