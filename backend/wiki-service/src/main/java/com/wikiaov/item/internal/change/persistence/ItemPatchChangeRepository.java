package com.wikiaov.item.internal.change.persistence;

import com.wikiaov.item.internal.change.persistence.entity.ItemPatchChange;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemPatchChangeRepository extends JpaRepository<ItemPatchChange, UUID> {
    List<ItemPatchChange> findByRulesetId(UUID rulesetId);

    List<ItemPatchChange> findByRulesetIdAndPatchVariantId(UUID rulesetId, UUID patchVariantId);

    List<ItemPatchChange> findByOwnerId(UUID ownerId);

    boolean existsByOwnerIdAndPatchVariantId(UUID ownerId, UUID patchVariantId);
}
