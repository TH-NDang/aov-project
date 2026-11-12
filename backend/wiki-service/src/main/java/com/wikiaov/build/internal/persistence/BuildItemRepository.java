package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.BuildItemRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BuildItemRepository extends JpaRepository<BuildItemRow, BuildItemRow.Key> {
    List<BuildItemRow> findByBuildIdOrderBySlotAsc(UUID buildId);

    List<BuildItemRow> findByBuildIdIn(Collection<UUID> buildIds);
}
