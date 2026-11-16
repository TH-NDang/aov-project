package com.wikiaov.arcana.internal.catalog.persistence;

import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ArcanaRevisionRepository extends JpaRepository<ArcanaRevision, UUID> {
    List<ArcanaRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<ArcanaRevision> findByOwnerIdInAndState(Collection<UUID> ownerIds, String state);

    List<ArcanaRevision> findByStateNot(String state);

    List<ArcanaRevision> findByRulesetIdAndState(UUID rulesetId, String state);

    @Query("""
            select r from ArcanaRevision r where r.rulesetId = :rulesetId and r.state = 'PUBLISHED'
            and (r.effectiveFromPatchVariantId = :variantId or exists (
                select f.id from ArcanaPatchChange f where f.patchVariantId = :variantId and f.toRevisionId = r.id))
            """)
    List<ArcanaRevision> publishedForChanges(UUID rulesetId, UUID variantId);
}
