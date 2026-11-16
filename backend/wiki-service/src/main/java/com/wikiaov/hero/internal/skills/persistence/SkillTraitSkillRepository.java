package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.hero.internal.skills.persistence.entity.SkillTraitSkillRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillTraitSkillRepository extends JpaRepository<SkillTraitSkillRow, SkillTraitSkillRow.Key> {
    List<SkillTraitSkillRow> findBySkillSetRevisionIdIn(Collection<UUID> ids);
}
