package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface HeroMediaUsageRepository extends Repository<HeroRevision, UUID> {
    interface Usage {
        UUID getHeroId();

        UUID getRevisionId();

        String getState();

        String getRole();
    }

    @Query("""
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,b.mediaRole as role
            from HeroRevision r,MediaBindingRow b
            where b.mediaBindingRevisionId=r.mediaBindingRevisionId and b.assetId=:assetId and r.state<>'DISCARDED'
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,concat('SKILL_ICON:',s.skillKey) as role
            from HeroRevision r,SkillSnapshotRow s
            where s.skillSetRevisionId=r.skillsRevisionId and s.iconAssetId=:assetId and r.state<>'DISCARDED'
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,concat('SKIN_ART:',s.skinKey) as role
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.artAssetId=:assetId and r.state<>'DISCARDED'
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,concat('SKIN_HEAD:',s.skinKey) as role
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.headAssetId=:assetId and r.state<>'DISCARDED'
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,concat('SKIN_PORTRAIT:',s.skinKey) as role
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.portraitAssetId=:assetId and r.state<>'DISCARDED'
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,b.mediaRole as role
            from HeroRevision r,HeroImageOption b
            where b.mediaBindingRevisionId=r.mediaBindingRevisionId and b.assetId=:assetId and r.state<>'DISCARDED'
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,
                concat('SKIN_',case when b.mediaRole='SPLASH' then 'ART' else b.mediaRole end,':',b.skinKey) as role
            from HeroRevision r,SkinImageOption b
            where b.skinSetRevisionId=r.skinsRevisionId and b.assetId=:assetId and r.state<>'DISCARDED'
            """)
    List<Usage> findUsages(UUID assetId);
}
