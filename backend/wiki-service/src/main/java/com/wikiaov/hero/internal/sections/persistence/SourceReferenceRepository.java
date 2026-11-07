package com.wikiaov.hero.internal.sections.persistence;

import com.wikiaov.hero.internal.sections.persistence.entity.SourceReferenceRow;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SourceReferenceRepository extends JpaRepository<SourceReferenceRow, UUID> {
    List<SourceReferenceRow> findByOwnerTypeAndOwnerRevisionIdOrderByPosition(String ownerType, UUID ownerRevisionId);

    List<SourceReferenceRow> findByOwnerTypeAndOwnerRevisionIdInOrderByPosition(String ownerType,
            Collection<UUID> ownerRevisionIds);
}
