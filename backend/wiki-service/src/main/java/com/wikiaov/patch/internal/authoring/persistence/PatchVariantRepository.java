package com.wikiaov.patch.internal.authoring.persistence;

import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
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

    List<PatchVariant> findByPatchIdOrderByRulesetOrdinalAsc(UUID patchId);

    List<PatchVariant> findByRulesetIdAndRulesetOrdinalGreaterThanEqualOrderByRulesetOrdinalDesc(
            UUID rulesetId, long ordinal);

    @Query("select new com.wikiaov.patch.internal.authoring.persistence.SeasonVariant(v.id,v.rulesetOrdinal,s.ordinal) "
            + "from PatchVariant v left join RankedSeason s on s.id=v.seasonId "
            + "where v.rulesetId=:rulesetId order by v.rulesetOrdinal")
    List<SeasonVariant> orderedSeasonVariants(UUID rulesetId);

    @Query("select v.rulesetId as rulesetId,v.rulesetOrdinal as ordinal,v.status as status "
            + "from PatchVariant v where v.id=:id")
    Optional<Snapshot> snapshotById(UUID id);

    interface Snapshot {
        UUID getRulesetId();

        long getOrdinal();

        String getStatus();
    }

    default void makeOrdinalSpace(UUID rulesetId, long ordinal) {
        for (var variant : findByRulesetIdAndRulesetOrdinalGreaterThanEqualOrderByRulesetOrdinalDesc(rulesetId,
                ordinal)) {
            variant.setRulesetOrdinal(Math.addExact(variant.getRulesetOrdinal(), 1));
            // Descending flushes avoid transient collisions with the unique ruleset ordinal.
            flush();
        }
    }
}
