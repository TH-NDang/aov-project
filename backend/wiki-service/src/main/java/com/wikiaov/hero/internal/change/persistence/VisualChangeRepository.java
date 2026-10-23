package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.VisualChangeClassification;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Reads and appends facts with the concrete table's own value types. */
public interface VisualChangeRepository extends JpaRepository<VisualChangeClassification, UUID> {
    List<VisualChangeClassification> findByChangeSetIdInOrderBySortOrderAscIdAsc(Collection<UUID> ids);
}
