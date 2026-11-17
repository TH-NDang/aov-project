package com.wikiaov.item.internal.catalog.persistence;

import com.wikiaov.item.internal.catalog.persistence.entity.ItemTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemTranslationRepository extends JpaRepository<ItemTranslation, UUID> {
    List<ItemTranslation> findByRevisionIdOrderByLocale(UUID revisionId);

    List<ItemTranslation> findByRevisionIdIn(Collection<UUID> ids);

    void deleteByRevisionId(UUID revisionId);
}
