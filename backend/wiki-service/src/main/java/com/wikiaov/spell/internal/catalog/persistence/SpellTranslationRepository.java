package com.wikiaov.spell.internal.catalog.persistence;

import com.wikiaov.spell.internal.catalog.persistence.entity.SpellTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpellTranslationRepository extends JpaRepository<SpellTranslation, UUID> {
    List<SpellTranslation> findByRevisionIdOrderByLocale(UUID revisionId);

    List<SpellTranslation> findByRevisionIdIn(Collection<UUID> ids);

    void deleteByRevisionId(UUID revisionId);
}
