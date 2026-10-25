package com.wikiaov.hero.internal.skins.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/** Narrow bulk projections for published skin browsing; no draft data or unrelated hero sections are read. */
public interface PublicSkinCatalogRepository extends Repository<HeroRevision, UUID> {
    @Query("""
            select r.heroId as heroId,h.code as heroCode,r.profileRevisionId as profileId,
                r.skinsRevisionId as skinsId,r.mediaBindingRevisionId as bindingsId,
                r.effectiveFromPatchVariantId as variantId,r.publicationSequence as publicationSequence
            from HeroRevision r join HeroIdentity h on h.id=r.heroId
            where r.rulesetId=:rulesetId and r.state='PUBLISHED' and r.publishedAt<=:at
            order by h.code,r.publicationSequence desc
            """)
    List<Candidate> candidates(UUID rulesetId, Instant at);

    @Query("""
            select t.profileRevisionId as profileId,t.locale as locale,t.name as name
            from ProfileTranslationRow t where t.profileRevisionId in :ids
            """)
    List<ProfileText> profileTexts(Collection<UUID> ids);

    @Query("""
            select s.skinSetRevisionId as skinsId,s.skinKey as skinKey,s.displayOrder as displayOrder,
                s.rarityCode as rarityCode,s.portraitAssetId as portraitId,
                s.headAssetId as headId,s.artAssetId as artId
            from SkinSnapshotRow s where s.skinSetRevisionId in :ids
            order by s.skinSetRevisionId,s.displayOrder,s.skinKey
            """)
    List<Skin> skins(Collection<UUID> ids);

    @Query("""
            select t.skinSetRevisionId as skinsId,t.skinKey as skinKey,t.locale as locale,t.name as name
            from SkinTranslationRow t where t.skinSetRevisionId in :ids
            """)
    List<SkinText> skinTexts(Collection<UUID> ids);

    @Query("""
            select b.mediaBindingRevisionId as bindingsId,b.assetId as assetId
            from MediaBindingRow b where b.mediaBindingRevisionId in :ids and b.mediaRole='HEAD'
            """)
    List<Head> heads(Collection<UUID> ids);

    @Query("""
            select b.code as code,t.locale as locale,t.displayName as name,t.iconAssetId as iconId
            from SkinBadge b join SkinBadgeTranslation t on t.badgeId=b.id
            where b.code in :codes
            """)
    List<BadgeText> badgeTexts(Collection<String> codes);

    interface Candidate {
        UUID getHeroId();

        String getHeroCode();

        UUID getProfileId();

        UUID getSkinsId();

        UUID getBindingsId();

        UUID getVariantId();

        Long getPublicationSequence();
    }

    interface ProfileText {
        UUID getProfileId();

        String getLocale();

        String getName();
    }

    interface Skin {
        UUID getSkinsId();

        String getSkinKey();

        int getDisplayOrder();

        String getRarityCode();

        UUID getPortraitId();

        UUID getHeadId();

        UUID getArtId();
    }

    interface SkinText {
        UUID getSkinsId();

        String getSkinKey();

        String getLocale();

        String getName();
    }

    interface Head {
        UUID getBindingsId();

        UUID getAssetId();
    }

    interface BadgeText {
        String getCode();

        String getLocale();

        String getName();

        UUID getIconId();
    }
}
