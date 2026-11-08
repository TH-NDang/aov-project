package com.wikiaov.gamemode.internal.guide.persistence;

import com.wikiaov.gamemode.internal.guide.persistence.entity.AutoChessRevision;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AutoChessRevisionRepository extends JpaRepository<AutoChessRevision, UUID> {
    Optional<AutoChessRevision> findByIdAndModeId(UUID id, UUID modeId);

    Optional<AutoChessRevision> findByModeIdAndState(UUID modeId, String state);

    Optional<AutoChessRevision> findFirstByModeIdAndStateOrderByRevisionNoDesc(UUID modeId, String state);

    List<AutoChessRevision> findByModeIdOrderByRevisionNoDesc(UUID modeId);

    List<AutoChessRevision> findByStateNot(String state);

    @Query("select coalesce(max(r.revisionNo), 0) from AutoChessRevision r where r.modeId = :modeId")
    long maxRevisionNo(UUID modeId);

    /** Modes that have a published guide, out of the given ones. */
    @Query("select distinct r.modeId from AutoChessRevision r where r.state = 'PUBLISHED' and r.modeId in :modeIds")
    List<UUID> publishedModeIds(Collection<UUID> modeIds);
}
