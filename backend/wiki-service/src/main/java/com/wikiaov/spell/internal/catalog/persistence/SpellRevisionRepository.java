package com.wikiaov.spell.internal.catalog.persistence;

import com.wikiaov.platform.RevisionState;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SpellRevisionRepository extends JpaRepository<SpellRevision, UUID> {
    List<SpellRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<SpellRevision> findByOwnerIdInAndState(Collection<UUID> ownerIds, RevisionState state);

    List<SpellRevision> findByStateNot(RevisionState state);

    List<SpellRevision> findByRulesetIdAndState(UUID rulesetId, RevisionState state);

    @Query("""
            select r from SpellRevision r where r.rulesetId = :rulesetId and r.state = com.wikiaov.platform.RevisionState.PUBLISHED
            and (r.effectiveFromPatchVariantId = :variantId or exists (
                select f.id from SpellPatchChange f where f.patchVariantId = :variantId and f.toRevisionId = r.id)
                or exists (select e.id from SpellRemoval e where e.patchVariantId = :variantId and e.revisionId = r.id))
            """)
    List<SpellRevision> publishedForChanges(UUID rulesetId, UUID variantId);
}
