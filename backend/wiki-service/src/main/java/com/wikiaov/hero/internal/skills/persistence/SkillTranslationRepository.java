package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.hero.internal.skills.persistence.entity.SkillTranslationRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillTranslationRepository extends JpaRepository<SkillTranslationRow, SkillTranslationRow.Key> {
    List<SkillTranslationRow> findBySkillSetRevisionIdIn(Collection<UUID> ids, Sort sort);
}
