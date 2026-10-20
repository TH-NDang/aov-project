package com.wikiaov.spell.internal.persistence;
import com.wikiaov.spell.internal.persistence.entity.SpellTranslation;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
public interface SpellTranslationRepository extends JpaRepository<SpellTranslation, UUID> {
    List<SpellTranslation> findByRevisionIdOrderByLocale(UUID revisionId);
    List<SpellTranslation> findByRevisionIdIn(Collection<UUID> ids);
    void deleteByRevisionId(UUID revisionId);
}
