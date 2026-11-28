package com.wikiaov.patch;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One translated title of the patch a variant belongs to, for pickers in other modules. A patch without translations
 * appears once with no locale and no title.
 */
public record PatchVariantTitle(
        UUID variantId,
        String patchCode,
        @Nullable String locale,
        @Nullable String title
) {
}
