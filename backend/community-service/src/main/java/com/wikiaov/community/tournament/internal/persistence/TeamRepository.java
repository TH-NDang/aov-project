package com.wikiaov.community.tournament.internal.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TeamRepository extends JpaRepository<TeamRecord, UUID> {
    @Query(value = """
        SELECT * FROM tournament.team
         WHERE (:state='ALL' OR (:state='ACTIVE' AND deleted_at IS NULL) OR (:state='DELETED' AND deleted_at IS NOT NULL))
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
         ORDER BY updated_at DESC,id
        """, countQuery = """
        SELECT COUNT(*) FROM tournament.team
         WHERE (:state='ALL' OR (:state='ACTIVE' AND deleted_at IS NULL) OR (:state='DELETED' AND deleted_at IS NOT NULL))
           AND reference_search LIKE '%' || tournament.normalize_reference_search(:query) || '%' ESCAPE '\\'
        """, nativeQuery = true)
    Page<TeamRecord> search(String query, String state, Pageable page);
}
