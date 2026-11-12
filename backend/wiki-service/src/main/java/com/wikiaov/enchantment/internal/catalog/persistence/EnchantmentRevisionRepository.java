package com.wikiaov.enchantment.internal.catalog.persistence;

import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EnchantmentRevisionRepository extends JpaRepository<EnchantmentRevision, UUID> {
    List<EnchantmentRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<EnchantmentRevision> findByOwnerIdInAndState(Collection<UUID> ownerIds, String state);

    List<EnchantmentRevision> findByStateNot(String state);

    List<EnchantmentRevision> findByRulesetIdAndState(UUID rulesetId, String state);

    @Query("""
            select r from EnchantmentRevision r where r.rulesetId = :rulesetId and r.state = 'PUBLISHED'
            and (r.effectiveFromPatchVariantId = :variantId or exists (
                select f.id from EnchantmentPatchChange f where f.patchVariantId = :variantId and f.toRevisionId = r.id))
            """)
    List<EnchantmentRevision> publishedForChanges(UUID rulesetId, UUID variantId);

    List<EnchantmentRevision> findByIconAssetIdAndStateNot(UUID assetId, String state);
}
