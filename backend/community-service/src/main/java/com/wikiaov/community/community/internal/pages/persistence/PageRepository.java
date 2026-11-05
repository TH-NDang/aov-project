package com.wikiaov.community.community.internal.pages.persistence;

import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface PageRepository extends JpaRepository<PageRecord, UUID> {

    @Query(value = """
        SELECT * FROM community.page
        WHERE (:kind IS NULL OR kind = :kind) AND (:published = false OR published_content IS NOT NULL)
          AND (:roles = '' OR (kind IN ('PERSON', 'PLAYER') AND jsonb_exists_any(
            (CASE WHEN :published THEN published_content ELSE content END)->'personRoles', string_to_array(:roles, ','))))
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR
            lower((CASE WHEN :published THEN published_content ELSE content END)->>'name') LIKE lower(concat('%', :query, '%')))
        ORDER BY updated_at DESC, id
        """, countQuery = """
        SELECT count(*) FROM community.page
        WHERE (:kind IS NULL OR kind = :kind) AND (:published = false OR published_content IS NOT NULL)
          AND (:roles = '' OR (kind IN ('PERSON', 'PLAYER') AND jsonb_exists_any(
            (CASE WHEN :published THEN published_content ELSE content END)->'personRoles', string_to_array(:roles, ','))))
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR
            lower((CASE WHEN :published THEN published_content ELSE content END)->>'name') LIKE lower(concat('%', :query, '%')))
        """, nativeQuery = true)
    Page<PageRecord> search(String kind, String query, String roles, boolean published, Pageable pageable);

    Optional<PageRecord> findByCode(String code);

    @Query(value = """
        SELECT * FROM community.page
        WHERE kind = 'TEAM' AND (:published = false OR published_content IS NOT NULL)
          AND (CASE WHEN :published THEN published_content ELSE content END)->'roster'
            @> jsonb_build_array(jsonb_build_object('pageId', CAST(:memberId AS text)))
        ORDER BY updated_at DESC, id
        """, nativeQuery = true)
    List<PageRecord> teamsForMember(String memberId, boolean published);

    @Query(value = """
        SELECT count(*) FROM community.page WHERE kind = 'TEAM' AND (
          content->'roster' @> jsonb_build_array(jsonb_build_object('pageId', CAST(:memberId AS text))) OR
          published_content->'roster' @> jsonb_build_array(jsonb_build_object('pageId', CAST(:memberId AS text))))
        """, nativeQuery = true)
    long countRosterReferences(String memberId);

    @Query(value = """
        SELECT count(*) FROM community.page WHERE kind = 'CIRCUIT' AND (
          content->>'channelOrganizationId' = :id OR published_content->>'channelOrganizationId' = :id)
        """, nativeQuery = true)
    long countChannelReferences(String id);

    @Query(value = """
        SELECT p.* FROM community.page p JOIN community.follow f ON f.page_id = p.id
        WHERE f.actor = :actor AND p.published_content IS NOT NULL AND p.kind <> 'CIRCUIT'
        ORDER BY lower(p.published_content->>'name'), p.id
        """, countQuery = """
        SELECT count(*) FROM community.page p JOIN community.follow f ON f.page_id = p.id
        WHERE f.actor = :actor AND p.published_content IS NOT NULL AND p.kind <> 'CIRCUIT'
        """, nativeQuery = true)
    Page<PageRecord> followedBy(String actor, Pageable pageable);

    /** Published pages the account neither follows nor manages, the most followed first. */
    @Query(value = """
        SELECT p.* FROM community.page p
        WHERE p.published_content IS NOT NULL AND p.kind <> 'CIRCUIT'
          AND NOT EXISTS (SELECT 1 FROM community.follow f WHERE f.page_id = p.id AND f.actor = :actor)
          AND NOT EXISTS (SELECT 1 FROM community.page_member m WHERE m.page_id = p.id AND m.actor = :actor)
        ORDER BY (SELECT count(*) FROM community.follow f WHERE f.page_id = p.id) DESC, p.updated_at DESC, p.id
        """, countQuery = """
        SELECT count(*) FROM community.page p
        WHERE p.published_content IS NOT NULL AND p.kind <> 'CIRCUIT'
          AND NOT EXISTS (SELECT 1 FROM community.follow f WHERE f.page_id = p.id AND f.actor = :actor)
          AND NOT EXISTS (SELECT 1 FROM community.page_member m WHERE m.page_id = p.id AND m.actor = :actor)
        """, nativeQuery = true)
    Page<PageRecord> suggestedFor(String actor, Pageable pageable);

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
