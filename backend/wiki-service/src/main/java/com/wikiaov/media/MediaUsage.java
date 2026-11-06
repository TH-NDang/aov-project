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
 * @param shown        whether that place really draws the image; {@code false} means only the id is kept there, as for
 *                     an unchosen image option or a skin head that a portrait replaces
 * @param ownerName    readable owner name when the provider was asked about one asset; lists leave it out
 * @param partName     readable name of the part inside the owner, e.g. the skin or skill
 */
public record MediaUsage(
        String ownerDomain,
        String ownerType,
        UUID ownerId,
        @Nullable UUID revisionId,
        String propertyRole,
        MediaUsageScope scope,
        boolean shown,
        @Nullable String ownerName,
        @Nullable String partName
) {

    public MediaUsage {
        Objects.requireNonNull(ownerDomain, "ownerDomain");
        Objects.requireNonNull(ownerType, "ownerType");
        Objects.requireNonNull(ownerId, "ownerId");
        Objects.requireNonNull(propertyRole, "propertyRole");
        Objects.requireNonNull(scope, "scope");
    }

    /** A reference whose place draws the image. */
    public MediaUsage(String ownerDomain, String ownerType, UUID ownerId, @Nullable UUID revisionId,
            String propertyRole, MediaUsageScope scope) {
        this(ownerDomain, ownerType, ownerId, revisionId, propertyRole, scope, true, null, null);
    }

    public MediaUsage storedOnly() {
        return new MediaUsage(ownerDomain, ownerType, ownerId, revisionId, propertyRole, scope, false, ownerName,
                partName);
    }

    public MediaUsage named(@Nullable String owner, @Nullable String part) {
        return new MediaUsage(ownerDomain, ownerType, ownerId, revisionId, propertyRole, scope, shown, owner, part);
    }
}
