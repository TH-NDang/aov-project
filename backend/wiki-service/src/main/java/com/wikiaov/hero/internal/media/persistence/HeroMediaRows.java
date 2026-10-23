package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.media.persistence.entity.HeroImageOption;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinImageOption;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinSnapshotRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinTranslationRow;

import java.util.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface HeroMediaRows extends Repository<HeroRevision, UUID> {
    @Query("select h from HeroIdentity h where h.id in :ids")
    List<HeroIdentity> heroes(Collection<UUID> ids);

    @Query("select t from ProfileTranslationRow t where t.profileRevisionId in :ids")
    List<ProfileTranslationRow> profiles(Collection<UUID> ids);

    @Query("select b from MediaBindingRow b where b.mediaBindingRevisionId in :ids")
    List<MediaBindingRow> bindings(Collection<UUID> ids);

    @Query("select o from HeroImageOption o where o.mediaBindingRevisionId in :ids")
    List<HeroImageOption> heroImages(Collection<UUID> ids);

    @Query("select s from SkinSnapshotRow s where s.skinSetRevisionId in :ids")
    List<SkinSnapshotRow> skins(Collection<UUID> ids);

    @Query("select t from SkinTranslationRow t where t.skinSetRevisionId in :ids")
    List<SkinTranslationRow> skinTranslations(Collection<UUID> ids);

    @Query("select o from SkinImageOption o where o.skinSetRevisionId in :ids")
    List<SkinImageOption> skinImages(Collection<UUID> ids);
}
