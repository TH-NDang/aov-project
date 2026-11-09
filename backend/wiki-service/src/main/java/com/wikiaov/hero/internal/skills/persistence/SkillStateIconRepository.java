package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.hero.internal.skills.persistence.entity.SkillStateIconRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillStateIconRepository extends JpaRepository<SkillStateIconRow, SkillStateIconRow.Key> {
    List<SkillStateIconRow> findBySkillSetRevisionIdIn(Collection<UUID> ids, Sort sort);
}
