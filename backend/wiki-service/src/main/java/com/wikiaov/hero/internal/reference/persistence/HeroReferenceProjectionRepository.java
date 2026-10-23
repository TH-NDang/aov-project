package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface HeroReferenceProjectionRepository
        extends
            Repository<HeroRevision, UUID>,
            PublishedHeroReferenceSelections {
    @Query("""
            select new com.wikiaov.hero.internal.reference.persistence.HeroReferenceProjection(
                h.id, r.id, m.assetId, t.locale, t.name, substring(coalesce(t.summary, ''), 1, 4000))
            from HeroIdentity h join HeroRevision r on r.heroId = h.id
            join ProfileTranslationRow t on t.profileRevisionId = r.profileRevisionId
            left join MediaBindingRow m on m.mediaBindingRevisionId = r.mediaBindingRevisionId and m.mediaRole = 'HEAD'
            where r.rulesetId = :rulesetId and r.state <> 'DISCARDED' and not exists (
                select n.id from HeroRevision n where n.heroId = r.heroId and n.rulesetId = r.rulesetId
                and n.state <> 'DISCARDED' and n.revisionNo > r.revisionNo)
            order by h.code, t.locale
            """)
    List<HeroReferenceProjection> findAuthoringReferences(@Param("rulesetId") UUID rulesetId);
}
