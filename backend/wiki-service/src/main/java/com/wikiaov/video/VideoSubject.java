package com.wikiaov.video;

import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One subject a video can be attached to, as listed for authoring screens.
 *
 * @param kind    subject kind
 * @param id      owning record: the hero for skins, the entry itself otherwise
 * @param key     skin key, null for other kinds
 * @param code    slug of the owning record
 * @param name    display name in the requested locale, falling back to another locale and then to the key or code
 * @param aliases other names and legacy codes, used to match imported data
 */
public record VideoSubject(
        VideoSubjectKind kind,
        UUID id,
        @Nullable String key,
        String code,
        String name,
        List<String> aliases
) {

    public VideoSubject {
        aliases = List.copyOf(aliases);
    }
}
