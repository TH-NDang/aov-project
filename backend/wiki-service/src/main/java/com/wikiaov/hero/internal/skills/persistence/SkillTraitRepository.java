package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.hero.internal.skills.persistence.entity.SkillTraitRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillTraitRepository extends JpaRepository<SkillTraitRow, SkillTraitRow.Key> {
    List<SkillTraitRow> findBySkillSetRevisionIdIn(Collection<UUID> ids);
}
