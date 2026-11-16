package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.hero.internal.skills.persistence.entity.SkillTraitTranslationRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillTraitTranslationRepository
        extends
            JpaRepository<SkillTraitTranslationRow, SkillTraitTranslationRow.Key> {
    List<SkillTraitTranslationRow> findBySkillSetRevisionIdIn(Collection<UUID> ids);
}
