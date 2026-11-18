package com.wikiaov.community.community.internal.pages.persistence;

import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

/**
 * Pages and the lists that read their documents. Native SQL binds page kinds as their names: {@code kind} is one kind
 * or null for every kind, {@code individuals} the kinds that may carry personnel roles.
 */
public interface PageRepository extends JpaRepository<PageRecord, UUID> {

    @Query(value = """
        SELECT * FROM community.page
        WHERE (:kind IS NULL OR kind = :kind) AND (:published = false OR published_content IS NOT NULL)
          AND (:roles = '' OR (kind IN (:individuals) AND jsonb_exists_any(
            (CASE WHEN :published THEN published_content ELSE content END)->'personRoles', string_to_array(:roles, ','))))
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR
            lower((CASE WHEN :published THEN published_content ELSE content END)->>'name') LIKE lower(concat('%', :query, '%')))
        ORDER BY updated_at DESC, id
        """, countQuery = """
        SELECT count(*) FROM community.page
        WHERE (:kind IS NULL OR kind = :kind) AND (:published = false OR published_content IS NOT NULL)
          AND (:roles = '' OR (kind IN (:individuals) AND jsonb_exists_any(
            (CASE WHEN :published THEN published_content ELSE content END)->'personRoles', string_to_array(:roles, ','))))
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR
            lower((CASE WHEN :published THEN published_content ELSE content END)->>'name') LIKE lower(concat('%', :query, '%')))
        """, nativeQuery = true)
    Page<PageRecord> search(String kind, Collection<String> individuals, String query, String roles,
            boolean published, Pageable pageable);

    /**
     * Admin directory listing: drafts included, with the country, identity and ordering a directory asks for.
     */
    @Query(value = """
        SELECT * FROM community.page
        WHERE (:kind IS NULL OR kind = :kind)
          AND (:roles = '' OR (kind IN (:individuals) AND jsonb_exists_any(content->'personRoles', string_to_array(:roles, ','))))
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR lower(content->>'name') LIKE lower(concat('%', :query, '%')))
          AND (:country = '' OR content->>'country' = :country)
          AND (:entityIds = '' OR CAST(entity_id AS text) = ANY(string_to_array(:entityIds, ',')))
        ORDER BY CASE WHEN :sort = 'NAME' THEN lower(content->>'name') END,
                 CASE WHEN :sort = 'ACTIVITY' THEN jsonb_array_length(coalesce(content->'history', '[]')) END DESC,
                 updated_at DESC, id
        """, countQuery = """
        SELECT count(*) FROM community.page
        WHERE (:kind IS NULL OR kind = :kind)
          AND (:roles = '' OR (kind IN (:individuals) AND jsonb_exists_any(content->'personRoles', string_to_array(:roles, ','))))
          AND (lower(code) LIKE lower(concat('%', :query, '%')) OR lower(content->>'name') LIKE lower(concat('%', :query, '%')))
          AND (:country = '' OR content->>'country' = :country)
          AND (:entityIds = '' OR CAST(entity_id AS text) = ANY(string_to_array(:entityIds, ',')))
        """, nativeQuery = true)
    Page<PageRecord> adminDirectory(String kind, Collection<String> individuals, String query, String roles,
            String country, String entityIds, String sort, Pageable pageable);

    /**
     * Pages for a picker or directory ordered by activity. An exact name comes first, then pages tied to the page in
     * context by their history, then the strength of the name match and the last activity. Activity is read from the
     * one view the tournament module publishes for this; {@code kinds} tells it which of its parts are needed, and a
     * page of an {@code identities} kind is found there by the identity it stands for.
     */
    @Query(value = """
        SELECT p.id AS id,
               coalesce(a.active_on, CASE WHEN p.history_last_on IS NOT NULL THEN LEAST(p.history_last_on, CURRENT_DATE) END)
                   AS "lastActiveOn",
               :relatedPageId <> '' AND p.content->'history'
                   @> jsonb_build_array(jsonb_build_object('relatedPageId', :relatedPageId)) AS related
        FROM community.page p
        LEFT JOIN tournament.page_activity a
          ON a.kind = p.kind AND a.kind = ANY(string_to_array(:kinds, ','))
         AND a.key_id = CASE WHEN p.kind IN (:identities) THEN p.entity_id ELSE p.id END
        WHERE (:kind IS NULL OR p.kind = :kind)
          AND (:roles = '' OR (p.kind IN (:individuals) AND jsonb_exists_any(p.content->'personRoles', string_to_array(:roles, ','))))
          AND strpos(p.search_names, tournament.search_key(:query)) > 0
          AND (:country = '' OR p.content->>'country' = :country)
        ORDER BY tournament.name_match_rank(tournament.search_key(:query), p.search_names) > 0,
                 :relatedPageId <> '' AND p.content->'history'
                     @> jsonb_build_array(jsonb_build_object('relatedPageId', :relatedPageId)) DESC,
                 tournament.name_match_rank(tournament.search_key(:query), p.search_names),
                 "lastActiveOn" DESC NULLS LAST,
                 lower(p.content->>'name'),
                 p.id
        """, countQuery = """
        SELECT count(*) FROM community.page p
        WHERE (:kind IS NULL OR p.kind = :kind)
          AND (:roles = '' OR (p.kind IN (:individuals) AND jsonb_exists_any(p.content->'personRoles', string_to_array(:roles, ','))))
          AND strpos(p.search_names, tournament.search_key(:query)) > 0
          AND (:country = '' OR p.content->>'country' = :country)
        """, nativeQuery = true)
    Page<ActiveRow> byActivity(String kind, String kinds, Collection<String> identities,
            Collection<String> individuals, String query, String roles, String country, String relatedPageId,
            Pageable pageable);

    interface ActiveRow {
        UUID getId();

        LocalDate getLastActiveOn();

        boolean getRelated();
    }

    Optional<PageRecord> findByCode(String code);

    @Query(value = """
        SELECT * FROM community.page
        WHERE kind = :team AND (:published = false OR published_content IS NOT NULL)
          AND (CASE WHEN :published THEN published_content ELSE content END)->'roster'
            @> jsonb_build_array(jsonb_build_object('pageId', CAST(:memberId AS text)))
        ORDER BY updated_at DESC, id
        """, nativeQuery = true)
    List<PageRecord> teamsForMember(String team, String memberId, boolean published);

    @Query(value = """
        SELECT count(*) FROM community.page WHERE kind = :team AND (
          content->'roster' @> jsonb_build_array(jsonb_build_object('pageId', CAST(:memberId AS text))) OR
          published_content->'roster' @> jsonb_build_array(jsonb_build_object('pageId', CAST(:memberId AS text))))
        """, nativeQuery = true)
    long countRosterReferences(String team, String memberId);

    @Query(value = """
        SELECT count(*) FROM community.page WHERE kind = :circuit AND (
          content->>'channelOrganizationId' = :id OR published_content->>'channelOrganizationId' = :id)
        """, nativeQuery = true)
    long countChannelReferences(String circuit, String id);

    /** Pages the account follows; {@code editorial} is the kind with no followers. */
    @Query(value = """
        SELECT p.* FROM community.page p JOIN community.follow f ON f.page_id = p.id
        WHERE f.actor = :actor AND p.published_content IS NOT NULL AND p.kind <> :editorial
        ORDER BY lower(p.published_content->>'name'), p.id
        """, countQuery = """
        SELECT count(*) FROM community.page p JOIN community.follow f ON f.page_id = p.id
        WHERE f.actor = :actor AND p.published_content IS NOT NULL AND p.kind <> :editorial
        """, nativeQuery = true)
    Page<PageRecord> followedBy(String actor, String editorial, Pageable pageable);

    /**
     * Published pages the account neither follows nor manages, the most followed first. {@code editorial} is the kind
     * with no followers.
     */
    @Query(value = """
        SELECT p.* FROM community.page p
        WHERE p.published_content IS NOT NULL AND p.kind <> :editorial
          AND NOT EXISTS (SELECT 1 FROM community.follow f WHERE f.page_id = p.id AND f.actor = :actor)
          AND NOT EXISTS (SELECT 1 FROM community.page_member m WHERE m.page_id = p.id AND m.actor = :actor)
        ORDER BY (SELECT count(*) FROM community.follow f WHERE f.page_id = p.id) DESC, p.updated_at DESC, p.id
        """, countQuery = """
        SELECT count(*) FROM community.page p
        WHERE p.published_content IS NOT NULL AND p.kind <> :editorial
          AND NOT EXISTS (SELECT 1 FROM community.follow f WHERE f.page_id = p.id AND f.actor = :actor)
          AND NOT EXISTS (SELECT 1 FROM community.page_member m WHERE m.page_id = p.id AND m.actor = :actor)
        """, nativeQuery = true)
    Page<PageRecord> suggestedFor(String actor, String editorial, Pageable pageable);

    Optional<PageRecord> findByKindAndEntityId(Kind kind, UUID entityId);

    long countByKindAndEntityId(Kind kind, UUID entityId);

    @Query(value = "select count(*) from community.page where cast(content as text) like concat('%/', :id, '/%') or cast(published_content as text) like concat('%/', :id, '/%') or cast(presentation as text) like concat('%/', :id, '/%')", nativeQuery = true)
    long countMedia(String id);

    @Query(value = """
        SELECT pairs.asset FROM (
        SELECT DISTINCT found.owner, lower(m[2]) AS asset FROM (
            SELECT id AS owner, content AS body FROM community.page
            UNION ALL SELECT id, published_content FROM community.page
            UNION ALL SELECT id, presentation FROM community.page
        ) found, LATERAL regexp_matches(CAST(found.body AS text), '/(assets|media)/([0-9a-fA-F-]{36})/', 'g') m
        ) pairs
        """, nativeQuery = true)
    List<String> allMedia();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
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
