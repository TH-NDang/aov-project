package com.wikiaov.community.tournament.internal.verification.persistence;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface ContentVerificationRepository extends JpaRepository<ContentVerificationRecord, UUID> {
    /** How far a tournament's checks go: the parts with a check of any version, and the newest check. */
    interface TournamentLine {
        UUID getTournamentId();

        long getParts();

        Instant getLastVerifiedAt();
    }

    List<ContentVerificationRecord> findByTournamentIdOrderByVerifiedAtDescIdAsc(UUID tournamentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ContentVerificationRecord> findByTournamentIdAndPartAndContentToken(UUID tournamentId, String part,
            String contentToken);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ContentVerificationRecord> findByIdAndTournamentId(UUID id, UUID tournamentId);

    @Query("""
        SELECT v.tournamentId AS tournamentId, count(DISTINCT v.part) AS parts, max(v.verifiedAt) AS lastVerifiedAt
          FROM ContentVerificationRecord v
         GROUP BY v.tournamentId
        """)
    List<TournamentLine> lines();
}
