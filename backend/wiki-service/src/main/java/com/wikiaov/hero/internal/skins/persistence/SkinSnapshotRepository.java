package com.wikiaov.hero.internal.skins.persistence;

import com.wikiaov.hero.internal.skins.persistence.entity.SkinSnapshotRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SkinSnapshotRepository extends JpaRepository<SkinSnapshotRow, SkinSnapshotRow.Key> {
    List<SkinSnapshotRow> findBySkinSetRevisionIdIn(Collection<UUID> ids, Sort sort);
}
