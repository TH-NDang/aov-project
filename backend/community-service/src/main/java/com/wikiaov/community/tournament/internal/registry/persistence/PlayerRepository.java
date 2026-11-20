package com.wikiaov.community.tournament.internal.registry.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PlayerRepository extends JpaRepository<PlayerRecord, UUID> {
    /** Native for the accent-folding search function of V002. */
    @Query(value = """
        SELECT * FROM tournament.player
         WHERE (:state='ALL' OR (:state='ACTIVE' AND deleted_at IS NULL) OR (:state='DELETED' AND deleted_at IS NOT NULL))
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
         ORDER BY updated_at DESC,id
        """, countQuery = """
        SELECT COUNT(*) FROM tournament.player
         WHERE (:state='ALL' OR (:state='ACTIVE' AND deleted_at IS NULL) OR (:state='DELETED' AND deleted_at IS NOT NULL))
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
        """, nativeQuery = true)
    Page<PlayerRecord> search(String query, String state, Pageable page);

    /** Active players of the country whose nickname or an alias has the name key of {@code name} (V023). */
    @Query(value = """
        SELECT * FROM tournament.player p
         WHERE p.deleted_at IS NULL AND p.content->>'country'=:country AND tournament.name_key(:name)<>''
           AND EXISTS(SELECT 1 FROM unnest(ARRAY[p.name] || tournament.alias_array(p.content->'aliases')) AS entry(other)
                       WHERE tournament.name_key(entry.other)=tournament.name_key(:name))
         ORDER BY p.created_at,p.id
         LIMIT 5
        """, nativeQuery = true)
    List<PlayerRecord> findSameName(String country, String name);
}
