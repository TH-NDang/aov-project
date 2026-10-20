package com.wikiaov.enchantment.internal.persistence;
import com.wikiaov.enchantment.internal.persistence.entity.EnchantmentPatchChange;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EnchantmentPatchChangeRepository extends JpaRepository<EnchantmentPatchChange, UUID> {
    List<EnchantmentPatchChange> findByRulesetId(UUID rulesetId);
    List<EnchantmentPatchChange> findByOwnerId(UUID ownerId);
    boolean existsByOwnerIdAndPatchVariantId(UUID ownerId, UUID patchVariantId);
}
