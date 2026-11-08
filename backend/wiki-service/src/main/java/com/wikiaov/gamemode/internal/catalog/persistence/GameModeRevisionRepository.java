package com.wikiaov.gamemode.internal.catalog.persistence;

import com.wikiaov.gamemode.internal.catalog.persistence.entity.GameModeRevision;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GameModeRevisionRepository extends JpaRepository<GameModeRevision, UUID> {
    Optional<GameModeRevision> findByIdAndModeId(UUID id, UUID modeId);

    Optional<GameModeRevision> findByModeIdAndState(UUID modeId, String state);

    Optional<GameModeRevision> findFirstByModeIdAndStateOrderByRevisionNoDesc(UUID modeId, String state);

    List<GameModeRevision> findByModeIdOrderByRevisionNoDesc(UUID modeId);

    List<GameModeRevision> findByStateNot(String state);

    @Query("select coalesce(max(r.revisionNo), 0) from GameModeRevision r where r.modeId = :modeId")
    long maxRevisionNo(UUID modeId);

    /** The publicly visible revision of every mode: the most recently published one. */
    @Query("""
            select r from GameModeRevision r
            where r.state = 'PUBLISHED' and r.revisionNo = (
                select max(p.revisionNo) from GameModeRevision p where p.modeId = r.modeId and p.state = 'PUBLISHED')
            """)
    List<GameModeRevision> latestPublished();
}
