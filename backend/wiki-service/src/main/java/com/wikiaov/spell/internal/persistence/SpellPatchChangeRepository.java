package com.wikiaov.spell.internal.persistence;
import com.wikiaov.spell.internal.persistence.entity.SpellPatchChange;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SpellPatchChangeRepository extends JpaRepository<SpellPatchChange, UUID> {
    List<SpellPatchChange> findByRulesetId(UUID rulesetId);
    List<SpellPatchChange> findByOwnerId(UUID ownerId);
    boolean existsByOwnerIdAndPatchVariantId(UUID ownerId, UUID patchVariantId);
}
