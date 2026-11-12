package com.wikiaov.item.internal.catalog.persistence;

import com.wikiaov.item.internal.catalog.persistence.entity.ItemRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ItemRevisionRepository extends JpaRepository<ItemRevision, UUID> {
    List<ItemRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<ItemRevision> findByOwnerIdInAndState(Collection<UUID> ownerIds, String state);

    List<ItemRevision> findByStateNot(String state);

    List<ItemRevision> findByRulesetIdAndState(UUID rulesetId, String state);

    @Query("""
            select r from ItemRevision r where r.rulesetId = :rulesetId and r.state = 'PUBLISHED'
            and (r.effectiveFromPatchVariantId = :variantId or exists (
                select f.id from ItemPatchChange f where f.patchVariantId = :variantId and f.toRevisionId = r.id))
            """)
    List<ItemRevision> publishedForChanges(UUID rulesetId, UUID variantId);

    List<ItemRevision> findByIconAssetIdAndStateNot(UUID assetId, String state);
}
