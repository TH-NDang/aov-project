package com.wikiaov.arcana.internal.catalog.application;

import com.wikiaov.arcana.internal.application.ArcanaErrorCode;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaRevision;
import com.wikiaov.arcana.internal.domain.ArcanaContent;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Stat;
import com.wikiaov.platform.CatalogTranslations;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Validates catalog content and explains publication readiness. */
@Component
class ArcanaContentRules {
    private final MediaAssets media;

    ArcanaContentRules(MediaAssets media) {
        this.media = media;
    }

    void validate(ArcanaContent content) {
        if (content == null)
            fail("Content is required.");
        CatalogTranslations.firstViolation(content.translations()).ifPresent(violation -> fail(violation.detail()));
        validateIcon(content.iconAssetId());
        if (content.notes() != null && content.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (content.color() != null && !Set.of("RED", "PURPLE", "GREEN").contains(content.color()))
            fail("Invalid arcana color.");
        if (content.tier() != null && (content.tier() < 1 || content.tier() > 3))
            fail("Invalid arcana tier.");
        validateStats(content.stats());
    }

    private void validateStats(List<Stat> stats) {
        var keys = new HashSet<String>();
        for (var stat : stats)
            if (stat.key() == null || !stat.key().matches("[a-z0-9]+(?:-[a-z0-9]+)*") || stat.value() == null
                    || !keys.add(stat.key()))
                fail("Invalid or duplicate numeric stat.");
    }

    private void validateIcon(UUID id) {
        if (id != null && media.find(id)
                .filter(asset -> asset.usable() && asset.semanticType() == MediaSemanticType.ARCANA_ICON)
                .isEmpty())
            fail("The icon must be an active uploaded arcana icon.");
    }

    List<UUID> assets(ArcanaContent content) {
        var result = new ArrayList<UUID>();
        if (content.iconAssetId() != null)
            result.add(content.iconAssetId());

        return result;
    }

    List<String> readiness(ArcanaRevision revision, ArcanaContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null)
            result.add("effectiveFromPatchVariantId");
        return result;
    }

    List<String> missing(ArcanaContent content) {
        var missing = new ArrayList<String>();
        if (content.iconAssetId() == null)
            missing.add("iconAssetId");
        if (content.translations().isEmpty())
            missing.add("translations");
        for (var translation : content.translations())
            if (translation.description() == null || translation.description().isBlank())
                missing.add("translations." + translation.locale() + ".description");
        if (content.color() == null)
            missing.add("color");
        if (content.tier() == null)
            missing.add("tier");
        if (content.stats().isEmpty())
            missing.add("stats");
        return missing;
    }

    private static void fail(String message) {
        throw new ApiException(ArcanaErrorCode.ARCANA_INVALID_CONTENT, message);
    }
}
