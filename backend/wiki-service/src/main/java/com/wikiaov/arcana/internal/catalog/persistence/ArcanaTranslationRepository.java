package com.wikiaov.arcana.internal.catalog.persistence;

import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArcanaTranslationRepository extends JpaRepository<ArcanaTranslation, UUID> {
    List<ArcanaTranslation> findByRevisionIdOrderByLocale(UUID revisionId);

    List<ArcanaTranslation> findByRevisionIdIn(Collection<UUID> ids);

    void deleteByRevisionId(UUID revisionId);
}
