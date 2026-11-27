package com.wikiaov.hero.internal.video.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.video.VideoSubjectName;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface HeroVideoSubjectRepository extends Repository<HeroIdentity, UUID> {
    interface LegacyCode {
        UUID getHeroId();

        String getLegacyCode();
    }

    @Query("""
            select distinct new com.wikiaov.video.VideoSubjectName(
                h.id, h.code, t.locale, t.name, coalesce(r.revisionNo, 0L))
            from HeroIdentity h
            left join HeroRevision r on r.heroId = h.id and r.state <> com.wikiaov.platform.RevisionState.DISCARDED
            left join ProfileTranslationRow t on t.profileRevisionId = r.profileRevisionId
            """)
    List<VideoSubjectName> heroNames();

    @Query("""
            select distinct new com.wikiaov.video.VideoSubjectName(
                h.id, s.skinKey, h.code, t.locale, t.name, coalesce(r.revisionNo, 0L))
            from SkinIdentityRow s
            join HeroIdentity h on h.id = s.heroId
            left join HeroRevision r on r.heroId = s.heroId and r.state <> com.wikiaov.platform.RevisionState.DISCARDED
            left join SkinTranslationRow t on t.skinSetRevisionId = r.skinsRevisionId and t.skinKey = s.skinKey
            """)
    List<VideoSubjectName> skinNames();

    @Query("select a.heroId as heroId, a.legacyCode as legacyCode from HeroCodeAlias a")
    List<LegacyCode> legacyCodes();
}
