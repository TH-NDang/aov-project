package com.wikiaov.build.internal.persistence;

import com.wikiaov.build.internal.persistence.entity.ArcanaPageEntryRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArcanaPageEntryRepository extends JpaRepository<ArcanaPageEntryRow, ArcanaPageEntryRow.Key> {
    List<ArcanaPageEntryRow> findByPageIdIn(Collection<UUID> pageIds);
}
