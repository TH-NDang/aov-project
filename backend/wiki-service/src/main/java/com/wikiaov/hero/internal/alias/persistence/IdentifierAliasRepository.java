package com.wikiaov.hero.internal.alias.persistence;

import com.wikiaov.hero.internal.alias.persistence.entity.ImageFileAlias;
import com.wikiaov.hero.internal.alias.persistence.entity.SkinKeyAlias;

import java.util.*;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

public interface IdentifierAliasRepository extends Repository<SkinKeyAlias, UUID> {
    @Query("select a from SkinKeyAlias a where a.heroId = :heroId")
    List<SkinKeyAlias> skins(UUID heroId);

    interface BadgeCode {
        String getLegacyCode();

        String getCode();
    }

    @Query("select a.legacyCode as legacyCode,b.code as code from SkinBadgeCodeAlias a,SkinBadge b where b.id = a.badgeId")
    List<BadgeCode> badges();

    @Query("select a from ImageFileAlias a where a.assetId in :ids")
    List<ImageFileAlias> images(Collection<UUID> ids);
}
