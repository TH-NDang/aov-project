package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface HeroMediaUsageRepository extends Repository<HeroRevision, UUID> {
    interface Usage {
        UUID getHeroId();

        UUID getRevisionId();

        String getState();

        UUID getAssetId();

        String getRole();

        Boolean getShown();
    }

    interface OwnerName {
        UUID getRevisionId();

        String getLocale();

        String getName();
    }

    interface PartName extends OwnerName {
        String getPartKey();
    }

    /**
     * Whatever the hero module references: one asset, or every asset when {@code all} is set. Image options repeat the
     * main image, so the same place can come back shown and not shown; callers keep the shown one.
     *
     * <p>Readers only see a skin head where the skin has no portrait, because the Wiki draws it in the portrait's place.
     */
    @Query("""
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,b.assetId as assetId,
                b.mediaRole as role,true as shown
            from HeroRevision r,MediaBindingRow b
            where b.mediaBindingRevisionId=r.mediaBindingRevisionId and r.state<>'DISCARDED'
                and (:all=true or b.assetId=:assetId)
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,s.iconAssetId as assetId,
                concat('SKILL_ICON:',s.skillKey) as role,true as shown
            from HeroRevision r,SkillSnapshotRow s
            where s.skillSetRevisionId=r.skillsRevisionId and s.iconAssetId is not null and r.state<>'DISCARDED'
                and (:all=true or s.iconAssetId=:assetId)
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,s.artAssetId as assetId,
                concat('SKIN_ART:',s.skinKey) as role,true as shown
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.artAssetId is not null and r.state<>'DISCARDED'
                and (:all=true or s.artAssetId=:assetId)
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,s.headAssetId as assetId,
                concat('SKIN_HEAD:',s.skinKey) as role,case when s.portraitAssetId is null then true else false end as shown
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.headAssetId is not null and r.state<>'DISCARDED'
                and (:all=true or s.headAssetId=:assetId)
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,s.portraitAssetId as assetId,
                concat('SKIN_PORTRAIT:',s.skinKey) as role,true as shown
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.portraitAssetId is not null and r.state<>'DISCARDED'
                and (:all=true or s.portraitAssetId=:assetId)
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,b.assetId as assetId,
                b.mediaRole as role,false as shown
            from HeroRevision r,HeroImageOption b
            where b.mediaBindingRevisionId=r.mediaBindingRevisionId and r.state<>'DISCARDED'
                and (:all=true or b.assetId=:assetId)
            union
            select distinct r.heroId as heroId,r.id as revisionId,r.state as state,b.assetId as assetId,
                concat('SKIN_',case when b.mediaRole='SPLASH' then 'ART' else b.mediaRole end,':',b.skinKey) as role,
                false as shown
            from HeroRevision r,SkinImageOption b
            where b.skinSetRevisionId=r.skinsRevisionId and r.state<>'DISCARDED'
                and (:all=true or b.assetId=:assetId)
            """)
    List<Usage> findUsages(UUID assetId, boolean all);

    @Query("""
            select r.id as revisionId,t.locale as locale,t.name as name
            from HeroRevision r,ProfileTranslationRow t
            where t.profileRevisionId=r.profileRevisionId and r.id in :revisionIds
            """)
    List<OwnerName> heroNames(Collection<UUID> revisionIds);

    @Query("""
            select r.id as revisionId,t.skinKey as partKey,t.locale as locale,t.name as name
            from HeroRevision r,SkinTranslationRow t
            where t.skinSetRevisionId=r.skinsRevisionId and r.id in :revisionIds
            """)
    List<PartName> skinNames(Collection<UUID> revisionIds);

    @Query("""
            select r.id as revisionId,t.skillKey as partKey,t.locale as locale,t.name as name
            from HeroRevision r,SkillTranslationRow t
            where t.skillSetRevisionId=r.skillsRevisionId and r.id in :revisionIds
            """)
    List<PartName> skillNames(Collection<UUID> revisionIds);
}
