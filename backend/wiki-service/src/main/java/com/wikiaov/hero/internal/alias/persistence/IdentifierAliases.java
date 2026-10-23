package com.wikiaov.hero.internal.alias.persistence;

import com.wikiaov.hero.internal.alias.persistence.entity.ImageFileAlias;
import com.wikiaov.hero.internal.alias.persistence.entity.SkinKeyAlias;
import com.wikiaov.hero.internal.badges.persistence.SkinBadgeRepository;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import java.text.Normalizer;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

/** Resolves legacy import keys before matching content or retaining collected images. */
@Repository
@RequiredArgsConstructor
public class IdentifierAliases {
    private final IdentifierAliasRepository aliases;
    private final IdentifierNamespaceRepository namespaces;
    private final SkinBadgeRepository badges;

    public String nextBadgeCode(String name, String region) {
        namespaces.lock("skin-badge");
        String base = Normalizer
                .normalize(name.toLowerCase(Locale.ROOT).replace('đ', 'd').replace("+", "-plus"), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        if (base.isBlank())
            throw new IllegalArgumentException("The badge name must contain Latin letters or digits.");
        base = base.substring(0, Math.min(base.length(), 48)).replaceAll("-$", "") + "-" + region;
        Set<String> used = new HashSet<>(badges.codes());
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
                : aliases.skins(heroId).stream()
                        .collect(Collectors.toMap(SkinKeyAlias::getLegacyKey, SkinKeyAlias::getSkinKey));
        Map<String, String> badgeCodes = aliases.badges().stream()
                .collect(Collectors.toMap(IdentifierAliasRepository.BadgeCode::getLegacyCode,
                        IdentifierAliasRepository.BadgeCode::getCode));
        return new Skins(incoming.skins().stream().map(s -> new Skin(keys.getOrDefault(s.skinKey(), s.skinKey()),
                s.displayOrder(), s.artAssetId(), badgeCodes.getOrDefault(s.rarityCode(), s.rarityCode()),
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
        var aliases = this.aliases.images(ids).stream()
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
