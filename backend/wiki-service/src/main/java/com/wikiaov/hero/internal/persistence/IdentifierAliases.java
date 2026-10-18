package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.persistence.entity.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.text.Normalizer;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Repository;

/** Resolves legacy import keys before matching content or retaining collected images. */
@Repository
public class IdentifierAliases {
    private final EntityManager entities;

    public IdentifierAliases(EntityManager entities) {
        this.entities = entities;
    }

    public String nextBadgeCode(String name, String region) {
        entities.find(IdentifierNamespace.class, "skin-badge", LockModeType.PESSIMISTIC_WRITE);
        String base = Normalizer
                .normalize(name.toLowerCase(Locale.ROOT).replace('đ', 'd').replace("+", "-plus"), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        if (base.isBlank())
            throw new IllegalArgumentException("The badge name must contain Latin letters or digits.");
        base = base.substring(0, Math.min(base.length(), 48)).replaceAll("-$", "") + "-" + region;
        Set<String> used = new HashSet<>(
                entities.createQuery("select b.code from SkinBadge b", String.class).getResultList());
        int sequence = 1;
        while (used.contains(base + "-" + sequence))
            sequence++;
        return base + "-" + sequence;
    }

    public Skins skins(UUID heroId, Skins incoming) {
        if (incoming.skins() == null || incoming.skins().stream().anyMatch(s -> s == null || s.skinKey() == null))
            throw new IllegalArgumentException("Skin records and their keys are required.");
        Map<String, String> keys = heroId == null
                ? Map.of()
                : entities
                        .createQuery("select a from SkinKeyAlias a where a.heroId = :hero", SkinKeyAlias.class)
                        .setParameter("hero", heroId).getResultStream()
                        .collect(Collectors.toMap(SkinKeyAlias::getLegacyKey, SkinKeyAlias::getSkinKey));
        Map<String, String> badges = entities.createQuery(
                "select a.legacyCode,b.code from SkinBadgeCodeAlias a,SkinBadge b where b.id=a.badgeId", Object[].class)
                .getResultStream().collect(Collectors.toMap(row -> (String) row[0], row -> (String) row[1]));
        return new Skins(incoming.skins().stream().map(s -> new Skin(keys.getOrDefault(s.skinKey(), s.skinKey()),
                s.displayOrder(), s.artAssetId(), badges.getOrDefault(s.rarityCode(), s.rarityCode()),
                s.translations(), s.headAssetId(), s.portraitAssetId(), images(s.images()))).toList(),
                incoming.sources());
    }

    public Bindings bindings(Bindings incoming) {
        return new Bindings(incoming.bindings(), incoming.sources(), images(incoming.images()));
    }

    private Map<MediaRole, List<ImageOption>> images(Map<MediaRole, List<ImageOption>> incoming) {
        var ids = incoming.values().stream().flatMap(Collection::stream).map(ImageOption::assetId).distinct().toList();
        if (ids.isEmpty())
            return incoming;
        var aliases = entities
                .createQuery("select a from ImageFileAlias a where a.assetId in :ids", ImageFileAlias.class)
                .setParameter("ids", ids).getResultStream()
                .collect(Collectors.toMap(ImageFileAlias::getAssetId, Function.identity()));
        Map<MediaRole, List<ImageOption>> result = new EnumMap<>(MediaRole.class);
        incoming.forEach((role, options) -> result.put(role, options.stream().map(option -> {
            var alias = aliases.get(option.assetId());
            return alias != null && (option.label() == null || option.label().equals(alias.getLegacyName()))
                    ? new ImageOption(option.assetId(), alias.getFileName())
                    : option;
        }).toList()));
        return result;
    }
}
