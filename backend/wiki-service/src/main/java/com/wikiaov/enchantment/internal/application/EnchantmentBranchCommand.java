package com.wikiaov.enchantment.internal.application;

import com.wikiaov.platform.CatalogText.MetadataTranslation;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

public record EnchantmentBranchCommand(
        @NotNull @PositiveOrZero Long expectedVersion,
        @PositiveOrZero int displayOrder,
        UUID iconAssetId,
        UUID backgroundAssetId,
        @Pattern(regexp = "#[0-9a-fA-F]{6}") String color,
        @NotNull @Size(min = 1, max = 50) List<MetadataTranslation> translations
) {
}
