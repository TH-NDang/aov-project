package com.wikiaov.hero.internal.domain;

import com.wikiaov.hero.internal.domain.HeroContent.*;
import java.util.*;

/** Retains collected artwork when an editor switches the main image. */
public final class HeroImages {
    private HeroImages() {
    }

    public static Object retain(Object previous, Object incoming) {
        if (previous instanceof Bindings old && incoming instanceof Bindings next)
            return new Bindings(next.bindings(), next.sources(),
                    merge(old.images(), old.bindings(), next.bindings(), next.images()));
        if (previous instanceof Skins old && incoming instanceof Skins next) {
            Map<String, Skin> existing = new HashMap<>();
            old.skins().forEach(skin -> existing.put(skin.skinKey(), skin));
            return new Skins(next.skins().stream().map(skin -> {
                var prior = existing.get(skin.skinKey());
                return prior == null
                        ? skin
                        : new Skin(skin.skinKey(), skin.displayOrder(), skin.artAssetId(),
                                skin.rarityCode(), skin.translations(), skin.headAssetId(), skin.portraitAssetId(),
                                merge(prior.images(), mains(prior), mains(skin), skin.images()));
            }).toList(), next.sources());
        }
        return incoming;
    }

    private static Map<MediaRole, UUID> mains(Skin skin) {
        Map<MediaRole, UUID> result = new EnumMap<>(MediaRole.class);
        if (skin.headAssetId() != null)
            result.put(MediaRole.HEAD, skin.headAssetId());
        if (skin.portraitAssetId() != null)
            result.put(MediaRole.PORTRAIT, skin.portraitAssetId());
        if (skin.artAssetId() != null)
            result.put(MediaRole.SPLASH, skin.artAssetId());
        return result;
    }

    private static Map<MediaRole, List<ImageOption>> merge(Map<MediaRole, List<ImageOption>> previous,
            Map<MediaRole, UUID> main, Map<MediaRole, UUID> nextMain, Map<MediaRole, List<ImageOption>> incoming) {
        Map<MediaRole, List<ImageOption>> result = new EnumMap<>(MediaRole.class);
        for (var role : MediaRole.values()) {
            Map<UUID, ImageOption> options = new LinkedHashMap<>();
            previous.getOrDefault(role, List.of()).forEach(option -> options.put(option.assetId(), option));
            if (main.containsKey(role) && !Objects.equals(main.get(role), nextMain.get(role)))
                options.putIfAbsent(main.get(role), new ImageOption(main.get(role), null));
            incoming.getOrDefault(role, List.of()).forEach(option -> options.put(option.assetId(), option));
            if (!options.isEmpty())
                result.put(role, List.copyOf(options.values()));
        }
        return result;
    }
}
