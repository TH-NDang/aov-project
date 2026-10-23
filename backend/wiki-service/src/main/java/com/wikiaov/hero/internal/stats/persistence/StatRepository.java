package com.wikiaov.hero.internal.stats.persistence;

import com.wikiaov.hero.internal.stats.persistence.entity.StatRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StatRepository extends JpaRepository<StatRow, StatRow.Key> {
    List<StatRow> findByStatsRevisionIdIn(Collection<UUID> ids, Sort sort);
}
