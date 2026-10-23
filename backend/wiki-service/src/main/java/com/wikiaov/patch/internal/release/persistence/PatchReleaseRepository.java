package com.wikiaov.patch.internal.release.persistence;

import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PatchReleaseRepository extends JpaRepository<PatchRelease, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from PatchRelease e where e.id = :id")
    Optional<PatchRelease> lockById(UUID id);

    List<PatchRelease> findBySeasonIdAndRegionId(UUID seasonId, UUID regionId);

    List<PatchRelease> findByPatchVariantIdOrderByEffectiveAtAsc(UUID patchVariantId);

    @Query("select r.regionId as regionId,r.patchVariantId as variantId from PatchRelease r where r.id=:id")
    Optional<Target> targetById(UUID id);

    @Query("select count(r)>0 from PatchRelease r join PatchVariant v on v.id=r.patchVariantId "
            + "where r.regionId=:regionId and r.status='SCHEDULED' and v.rulesetId=:rulesetId "
            + "and ((r.effectiveAt<=:at and v.rulesetOrdinal>=:ordinal) "
            + "or (r.effectiveAt>=:at and v.rulesetOrdinal<=:ordinal))")
    boolean contradictsTimeline(UUID regionId, UUID rulesetId, Instant at, long ordinal);

    interface Target {
        UUID getRegionId();

        UUID getVariantId();
    }
}
