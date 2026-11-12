package com.wikiaov.build;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * Implemented by every module that owns something a build refers to (ADR-026).
 *
 * <p>The owner stays the source of truth: the build module asks each provider instead of reading other modules' tables.
 * Items, arcana, enchantments and spells answer only records with a published revision; heroes answer every identity,
 * because a build may be recorded before the hero page is published.
 */
public interface BuildReferenceProvider {

    /** The kind answered by this provider. Each kind has exactly one provider. */
    BuildReferenceKind kind();

    /** Records by the codes a caller used; unknown codes are absent. A legacy hero code maps to the current hero. */
    Map<String, BuildReference> byCodes(Collection<String> codes);

    /** Records by identifier; unknown identifiers are absent. */
    Map<UUID, BuildReference> byIds(Collection<UUID> ids);
}
