package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.hero.internal.skills.persistence.entity.SkillEffectRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillEffectRepository extends JpaRepository<SkillEffectRow, SkillEffectRow.Key> {
    List<SkillEffectRow> findBySkillSetRevisionIdIn(Collection<UUID> ids, Sort sort);
}
