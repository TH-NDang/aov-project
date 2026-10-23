package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface HeroSkillReferenceProjectionRepository
        extends
            Repository<HeroRevision, UUID>,
            HeroSkillReferenceSelections {
    @Query("""
            select p.profileRevisionId as sectionId, p.locale as locale, p.name as name
            from ProfileTranslationRow p where p.profileRevisionId in :profileIds
            order by p.profileRevisionId, p.locale
            """)
    List<OwnerCopy> findOwnerCopies(@Param("profileIds") Collection<UUID> profileIds);

    interface OwnerCopy {
        UUID getSectionId();

        String getLocale();

        String getName();
    }
}
