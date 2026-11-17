package com.wikiaov.arcana.internal.catalog.persistence;

import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaRevision;
import com.wikiaov.platform.RevisionState;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ArcanaRevisionRepository extends JpaRepository<ArcanaRevision, UUID> {
    List<ArcanaRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<ArcanaRevision> findByOwnerIdInAndState(Collection<UUID> ownerIds, RevisionState state);

    List<ArcanaRevision> findByStateNot(RevisionState state);

    List<ArcanaRevision> findByRulesetIdAndState(UUID rulesetId, RevisionState state);

    @Query("""
            select r from ArcanaRevision r where r.rulesetId = :rulesetId and r.state = com.wikiaov.platform.RevisionState.PUBLISHED
            and (r.effectiveFromPatchVariantId = :variantId or exists (
                select f.id from ArcanaPatchChange f where f.patchVariantId = :variantId and f.toRevisionId = r.id))
            """)
    List<ArcanaRevision> publishedForChanges(UUID rulesetId, UUID variantId);
}
