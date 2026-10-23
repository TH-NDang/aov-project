package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.terminology.AdminReferenceProvider.Row;
import java.util.UUID;

/** Compact profile copy and head identity shared by the authoring and public reads. */
public record HeroReferenceProjection(
        UUID id,
        UUID revisionId,
        UUID iconAssetId,
        String locale,
        String name,
        String description
) {
    public Row reference() {
        return new Row(id, revisionId, iconAssetId, locale, name, description);
    }
}
