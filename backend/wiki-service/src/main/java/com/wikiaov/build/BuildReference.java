package com.wikiaov.build;

import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One record a build may refer to. {@code color} and {@code tier} are set for arcana, {@code branchCode} and
 * {@code tier} for enchantments, read from the latest published revision.
 */
public record BuildReference(
        UUID id,
        String code,
        @Nullable String color,
        @Nullable Integer tier,
        @Nullable String branchCode
) {
    public static BuildReference of(UUID id, String code) {
        return new BuildReference(id, code, null, null, null);
    }
}
