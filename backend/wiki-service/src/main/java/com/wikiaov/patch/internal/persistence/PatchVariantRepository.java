package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.patch.internal.persistence.entity.PatchVariant;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PatchVariantRepository extends JpaRepository<PatchVariant, UUID> {
    @Query("select new com.wikiaov.patch.PatchVariantReference(v.id,v.patchId,v.rulesetId,v.seasonId,"
            + "v.rulesetOrdinal,v.status='PUBLISHED') from PatchVariant v where v.rulesetId=:rulesetId")
    List<PatchVariantReference> referencesByRuleset(UUID rulesetId);
    List<PatchVariant> findBySeasonId(UUID seasonId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from PatchVariant e where e.id = :id")
    Optional<PatchVariant> lockById(UUID id);
}
