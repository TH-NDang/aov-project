package com.wikiaov.hero.internal.skills.persistence;

import com.wikiaov.hero.internal.skills.persistence.entity.SkillSnapshotRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkillSnapshotRepository extends JpaRepository<SkillSnapshotRow, SkillSnapshotRow.Key> {
    List<SkillSnapshotRow> findBySkillSetRevisionIdIn(Collection<UUID> ids, Sort sort);
}
