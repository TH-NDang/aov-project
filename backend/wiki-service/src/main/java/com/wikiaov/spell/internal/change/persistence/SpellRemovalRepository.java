package com.wikiaov.spell.internal.change.persistence;

import com.wikiaov.spell.internal.change.persistence.entity.SpellRemoval;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpellRemovalRepository extends JpaRepository<SpellRemoval, UUID> {
    List<SpellRemoval> findBySpellIdAndRulesetIdOrderByRecordedAtDesc(UUID spellId, UUID rulesetId);

    List<SpellRemoval> findByPatchVariantIdOrderByRecordedAtDesc(UUID patchVariantId);

    boolean existsBySpellIdAndPatchVariantId(UUID spellId, UUID patchVariantId);
}
