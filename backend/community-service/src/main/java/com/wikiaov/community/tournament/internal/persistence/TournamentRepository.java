package com.wikiaov.community.tournament.internal.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TournamentRepository extends JpaRepository<TournamentRecord, UUID> {
    @Query("""
        SELECT row FROM TournamentRecord row
         WHERE (lower(row.name) LIKE lower(concat('%',:query,'%')) OR lower(row.code) LIKE lower(concat('%',:query,'%')))
           AND (:state='ALL' OR (:state='ACTIVE' AND row.deletedAt IS NULL) OR (:state='DELETED' AND row.deletedAt IS NOT NULL))
        """)
    Page<TournamentRecord> search(String query, String state, Pageable page);
}
