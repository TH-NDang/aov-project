package com.wikiaov.community.tournament.internal.roster.persistence;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RosterRepository extends JpaRepository<RosterRecord, UUID> {
    @Query("""
        SELECT membership FROM RosterRecord membership
         WHERE (:tournamentId IS NULL OR membership.tournamentId=:tournamentId)
           AND (:teamId IS NULL OR membership.teamId=:teamId)
           AND (:playerId IS NULL OR membership.playerId=:playerId)
           AND (:state='ALL' OR (:state='ACTIVE' AND membership.deletedAt IS NULL) OR (:state='DELETED' AND membership.deletedAt IS NOT NULL))
        """)
    Page<RosterRecord> search(UUID tournamentId, UUID teamId, UUID playerId, String state, Pageable page);
}
