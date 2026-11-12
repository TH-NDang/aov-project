package com.wikiaov.hero.internal.gallery.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** The images a hero's versions show, read from the versions so the gallery never stores a copy (ADR-027). */
public interface HeroGalleryImagesRepository extends Repository<HeroRevision, UUID> {
    interface VersionImage {
        UUID getRevisionId();

        long getRevisionNo();

        String getState();

        UUID getPatchVariantId();

        UUID getAssetId();

        String getRole();
    }

    interface LibraryImage {
        UUID getAssetId();

        String getSkillKey();

        int getSourceSlot();

        int getVariantNo();
    }

    /**
     * Every place a version of the hero that was not discarded shows an image. Image options and a skin head that a
     * portrait replaces are left out: readers never see them.
     */
    @Query("""
            select r.id as revisionId,r.revisionNo as revisionNo,r.state as state,
                r.effectiveFromPatchVariantId as patchVariantId,b.assetId as assetId,b.mediaRole as role
            from HeroRevision r,MediaBindingRow b
            where b.mediaBindingRevisionId=r.mediaBindingRevisionId and r.heroId=:heroId and r.state<>'DISCARDED'
            union
            select r.id as revisionId,r.revisionNo as revisionNo,r.state as state,
                r.effectiveFromPatchVariantId as patchVariantId,s.iconAssetId as assetId,
                concat('SKILL_ICON:',s.skillKey) as role
            from HeroRevision r,SkillSnapshotRow s
            where s.skillSetRevisionId=r.skillsRevisionId and s.iconAssetId is not null and r.heroId=:heroId
                and r.state<>'DISCARDED'
            union
            select r.id as revisionId,r.revisionNo as revisionNo,r.state as state,
                r.effectiveFromPatchVariantId as patchVariantId,i.assetId as assetId,
                concat('SKILL_STATE:',i.skillKey) as role
            from HeroRevision r,SkillStateIconRow i
            where i.skillSetRevisionId=r.skillsRevisionId and r.heroId=:heroId and r.state<>'DISCARDED'
            union
            select r.id as revisionId,r.revisionNo as revisionNo,r.state as state,
                r.effectiveFromPatchVariantId as patchVariantId,s.artAssetId as assetId,
                concat('SKIN_ART:',s.skinKey) as role
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.artAssetId is not null and r.heroId=:heroId
                and r.state<>'DISCARDED'
            union
            select r.id as revisionId,r.revisionNo as revisionNo,r.state as state,
                r.effectiveFromPatchVariantId as patchVariantId,s.headAssetId as assetId,
                concat('SKIN_HEAD:',s.skinKey) as role
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.headAssetId is not null and s.portraitAssetId is null
                and r.heroId=:heroId and r.state<>'DISCARDED'
            union
            select r.id as revisionId,r.revisionNo as revisionNo,r.state as state,
                r.effectiveFromPatchVariantId as patchVariantId,s.portraitAssetId as assetId,
                concat('SKIN_PORTRAIT:',s.skinKey) as role
            from HeroRevision r,SkinSnapshotRow s
            where s.skinSetRevisionId=r.skinsRevisionId and s.portraitAssetId is not null and r.heroId=:heroId
                and r.state<>'DISCARDED'
            """)
    List<VersionImage> versionImages(UUID heroId);

    /** The hero's skill picture library, which skills without an icon of their own show. */
    @Query("""
            select i.assetId as assetId,i.skillKey as skillKey,i.sourceSlot as sourceSlot,i.variantNo as variantNo
            from HeroSkillImage i
            where i.heroId=:heroId
            order by i.sourceSlot,i.variantNo
            """)
    List<LibraryImage> libraryImages(UUID heroId);
}
