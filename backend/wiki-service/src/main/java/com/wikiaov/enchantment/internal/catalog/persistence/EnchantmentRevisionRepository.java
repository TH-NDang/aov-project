package com.wikiaov.enchantment.internal.catalog.persistence;

import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import com.wikiaov.platform.RevisionState;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EnchantmentRevisionRepository extends JpaRepository<EnchantmentRevision, UUID> {
    List<EnchantmentRevision> findByOwnerIdOrderByRevisionNoDesc(UUID ownerId);

    List<EnchantmentRevision> findByOwnerIdInAndState(Collection<UUID> ownerIds, RevisionState state);

    List<EnchantmentRevision> findByStateNot(RevisionState state);

    List<EnchantmentRevision> findByRulesetIdAndState(UUID rulesetId, RevisionState state);

    @Query("""
            select r from EnchantmentRevision r where r.rulesetId = :rulesetId and r.state = com.wikiaov.platform.RevisionState.PUBLISHED
            and (r.effectiveFromPatchVariantId = :variantId or exists (
                select f.id from EnchantmentPatchChange f where f.patchVariantId = :variantId and f.toRevisionId = r.id))
            """)
    List<EnchantmentRevision> publishedForChanges(UUID rulesetId, UUID variantId);
}
