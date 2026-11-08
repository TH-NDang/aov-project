package com.wikiaov.gamemode.internal.application;

import com.wikiaov.gamemode.internal.application.response.GameModeViews.Image;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Reads the images a mode or guide refers to through the Media contract; never touches media tables. */
@Component
public class GameModeImages {
    /** Image kinds a mode may show; game art first, then generic uploads. */
    public static final Set<MediaSemanticType> MODE_ART = Set.of(MediaSemanticType.GAME_MODE_ART,
            MediaSemanticType.OTHER);

    public static final Set<MediaSemanticType> ICONS = Set.of(MediaSemanticType.AUTO_CHESS_ICON,
            MediaSemanticType.OTHER);

    private final MediaAssets media;

    public GameModeImages(MediaAssets media) {
        this.media = media;
    }

    /** Usable images by asset id; missing or unready assets are left out instead of failing the page. */
    public Map<UUID, Image> hydrate(Collection<UUID> ids) {
        var result = new LinkedHashMap<UUID, Image>();
        if (ids.isEmpty())
            return result;
        media.findAll(ids).forEach((id, asset) -> {
            if (asset.usable())
                result.put(id, image(asset));
        });
        return result;
    }

    /**
     * Rejects publication when a referenced image is missing, unusable or of the wrong kind.
     *
     * @param expected allowed kinds by asset id
     */
    public void requirePublishable(Map<UUID, Set<MediaSemanticType>> expected) {
        if (expected.isEmpty())
            return;
        var found = media.findAll(expected.keySet());
        List<String> problems = new ArrayList<>();
        expected.forEach((id, kinds) -> {
            var asset = found.get(id);
            if (asset == null || !asset.usable())
                problems.add(id + " is not a ready image");
            else if (!kinds.contains(asset.semanticType()))
                problems.add(id + " is a " + asset.semanticType() + " image");
        });
        if (!problems.isEmpty())
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT,
                    "Some images cannot be published.", Map.of("images", problems));
    }

    private static Image image(MediaAssetReference asset) {
        var version = asset.currentVersion();
        return new Image(asset.assetId(), version.versionId(), version.url(), version.width(), version.height(),
                version.sources(),
                version.focalPoint());
    }
}
