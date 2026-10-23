package com.wikiaov.hero.internal.change.persistence;

import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface HeroPatchChangeTranslationRepository
        extends
            JpaRepository<HeroPatchChangeTranslation, HeroPatchChangeTranslation.Key> {
    List<HeroPatchChangeTranslation> findByChangeSetIdIn(Collection<UUID> ids);

    @Query("select t from HeroPatchChangeTranslation t where t.changeSetId = :id order by case when t.locale = :locale then 0 else 1 end, case when t.locale = 'vi-VN' then 0 else 1 end, t.locale")
    List<HeroPatchChangeTranslation> preferred(UUID id, String locale, Pageable page);
}
