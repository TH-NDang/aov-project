package com.wikiaov.gamemode.internal.mapguide.persistence;

import com.wikiaov.gamemode.internal.mapguide.persistence.entity.MapGuideRevision;
import com.wikiaov.platform.RevisionState;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface MapGuideRevisionRepository extends JpaRepository<MapGuideRevision, UUID> {
    Optional<MapGuideRevision> findByIdAndModeId(UUID id, UUID modeId);

    Optional<MapGuideRevision> findByModeIdAndState(UUID modeId, RevisionState state);

    Optional<MapGuideRevision> findFirstByModeIdAndStateOrderByRevisionNoDesc(UUID modeId, RevisionState state);

    List<MapGuideRevision> findByModeIdOrderByRevisionNoDesc(UUID modeId);

    List<MapGuideRevision> findByStateNot(RevisionState state);

    @Query("select coalesce(max(r.revisionNo), 0) from MapGuideRevision r where r.modeId = :modeId")
    long maxRevisionNo(UUID modeId);

    /** Modes that have a published map, out of the given ones. */
    @Query("select distinct r.modeId from MapGuideRevision r where r.state = com.wikiaov.platform.RevisionState.PUBLISHED and r.modeId in :modeIds")
    List<UUID> publishedModeIds(Collection<UUID> modeIds);
}
