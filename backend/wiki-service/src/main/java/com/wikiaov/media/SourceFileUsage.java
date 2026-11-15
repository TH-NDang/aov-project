package com.wikiaov.media;

import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One place where a source file is used as evidence.
 *
 * @param ownerDomain module that owns the reference, e.g. {@code BUILD}
 * @param ownerType   referencing object type, e.g. {@code BUILD_CAPTURE}
 * @param ownerId     referencing object id
 * @param ownerName   readable name of the referencing object, e.g. the capture code
 * @param role        what the file is to the owner, e.g. {@code CAPTURE_IMAGE}
 */
public record SourceFileUsage(
        String ownerDomain,
        String ownerType,
        UUID ownerId,
        @Nullable String ownerName,
        String role
) {

    public SourceFileUsage {
        Objects.requireNonNull(ownerDomain, "ownerDomain");
        Objects.requireNonNull(ownerType, "ownerType");
        Objects.requireNonNull(ownerId, "ownerId");
        Objects.requireNonNull(role, "role");
    }
}
