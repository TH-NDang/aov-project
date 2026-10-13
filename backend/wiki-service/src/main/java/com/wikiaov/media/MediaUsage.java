package com.wikiaov.media;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One place where an asset is referenced.
 *
 * @param ownerDomain  module that owns the reference, e.g. {@code HERO}
 * @param ownerType    referencing object type, e.g. {@code HERO}
 * @param ownerId      referencing object id
 * @param revisionId   referencing revision, if the owner is revisioned
 * @param propertyRole role of the asset for the owner, e.g. {@code PORTRAIT}
 * @param scope        current, draft or historical reference
 */
public record MediaUsage(
        String ownerDomain,
        String ownerType,
        UUID ownerId,
        @Nullable UUID revisionId,
        String propertyRole,
        MediaUsageScope scope
) {

    public MediaUsage {
        Objects.requireNonNull(ownerDomain, "ownerDomain");
        Objects.requireNonNull(ownerType, "ownerType");
        Objects.requireNonNull(ownerId, "ownerId");
        Objects.requireNonNull(propertyRole, "propertyRole");
        Objects.requireNonNull(scope, "scope");
    }
}
