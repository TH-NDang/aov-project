package com.wikiaov.spell.internal.domain;
import com.wikiaov.platform.CatalogText.*;
import java.math.BigDecimal;
import java.util.*;

public record SpellContent(
        UUID iconAssetId,
        BigDecimal cooldownSeconds,
        Integer unlockLevel,
        String unlockType,
        String availability,
        Boolean legacy,
        Integer displayOrder,
        BigDecimal chargeRechargeSeconds,
        Integer maxCharges,
        String defaultStateKey,
        List<SpellState> states,
        List<ReferenceImage> referenceImages,
        List<Translation> translations,
        String notes
) {
    public SpellContent {
        legacy = Boolean.TRUE.equals(legacy);
        displayOrder = displayOrder == null ? 0 : displayOrder;
        translations = translations == null ? List.of() : List.copyOf(translations);
        states = states == null ? List.of() : List.copyOf(states);
        referenceImages = referenceImages == null ? List.of() : List.copyOf(referenceImages);
        availability = availability == null ? "UNKNOWN" : availability;
        unlockType = unlockType == null ? "UNKNOWN" : unlockType;
    }
    public SpellContent mechanics() {
        var cleanStates = states.stream().map(state -> new SpellState(state.key(), state.iconAssetId(), List.of()))
                .toList();
        var cleanReferences = referenceImages.stream().map(image -> new ReferenceImage(image.assetId(), null)).toList();
        return new SpellContent(iconAssetId, cooldownSeconds, unlockLevel, unlockType, availability, legacy,
                displayOrder, chargeRechargeSeconds, maxCharges, defaultStateKey, cleanStates, cleanReferences,
                List.of(), null);
    }
    public SpellContent publicCopy(String locale) {
        var localizedStates = states.stream().map(state -> new SpellState(state.key(), state.iconAssetId(),
                com.wikiaov.platform.CatalogText.select(state.translations(), locale))).toList();
        return new SpellContent(iconAssetId, cooldownSeconds, unlockLevel, unlockType, availability, legacy,
                displayOrder, chargeRechargeSeconds, maxCharges, defaultStateKey, localizedStates, referenceImages,
                com.wikiaov.platform.CatalogText.select(translations, locale), null);
    }
    public SpellContent withTranslations(List<Translation> copy) {
        return new SpellContent(iconAssetId, cooldownSeconds, unlockLevel, unlockType, availability, legacy,
                displayOrder, chargeRechargeSeconds, maxCharges, defaultStateKey, states, referenceImages, copy, notes);
    }
    public record SpellState(
            String key,
            UUID iconAssetId,
            List<Translation> translations
    ) {
        public SpellState {
            translations = translations == null ? List.of() : List.copyOf(translations);
        }
    }
    public record ReferenceImage(
            UUID assetId,
            String notes
    ) {
    }
}
