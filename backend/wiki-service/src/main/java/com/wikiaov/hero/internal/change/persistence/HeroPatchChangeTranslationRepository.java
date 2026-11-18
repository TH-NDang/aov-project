package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroPatchChangeTranslationRepository
        extends
            JpaRepository<HeroPatchChangeTranslation, HeroPatchChangeTranslation.Key> {
    List<HeroPatchChangeTranslation> findByChangeSetIdIn(Collection<UUID> ids);
}
