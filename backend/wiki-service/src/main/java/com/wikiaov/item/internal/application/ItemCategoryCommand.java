package com.wikiaov.item.internal.application;

import com.wikiaov.platform.CatalogText.MetadataTranslation;
import jakarta.validation.constraints.*;
import java.util.*;

public record ItemCategoryCommand(
        @NotNull @PositiveOrZero Long expectedVersion,
        @PositiveOrZero int displayOrder,
        UUID iconAssetId,
        UUID backgroundAssetId,
        @Pattern(regexp = "#[0-9a-fA-F]{6}") String color,
        @NotNull @Size(min = 1, max = 50) List<MetadataTranslation> translations
) {
}
