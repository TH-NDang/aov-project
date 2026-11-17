package com.wikiaov.item.internal.catalog.persistence;

import com.wikiaov.item.internal.catalog.persistence.entity.ItemRevision;
import com.wikiaov.platform.RevisionState;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ItemRevisionRepository extends JpaRepository<ItemRevision, UUID> {
    List<ItemRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<ItemRevision> findByOwnerIdInAndState(Collection<UUID> ownerIds, RevisionState state);

    List<ItemRevision> findByStateNot(RevisionState state);

    List<ItemRevision> findByRulesetIdAndState(UUID rulesetId, RevisionState state);

    @Query("""
            select r from ItemRevision r where r.rulesetId = :rulesetId and r.state = com.wikiaov.platform.RevisionState.PUBLISHED
            and (r.effectiveFromPatchVariantId = :variantId or exists (
                select f.id from ItemPatchChange f where f.patchVariantId = :variantId and f.toRevisionId = r.id))
            """)
    List<ItemRevision> publishedForChanges(UUID rulesetId, UUID variantId);
}
