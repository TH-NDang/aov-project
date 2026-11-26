package com.wikiaov.patch.internal.watch.domain;

import java.time.Instant;
import java.util.Objects;
import org.jspecify.annotations.Nullable;

/**
 * One post as a source lists it.
 *
 * @param externalId  the source's own stable id: a post number, a slug or the link itself
 * @param url         absolute link to the post
 * @param title       title as listed, when the list carries one
 * @param channel     live game or test server
 * @param publishedAt when the source says the post went out, when it says so
 */
public record FoundPatchNote(
        String externalId,
        String url,
        @Nullable String title,
        PatchNoteChannel channel,
        @Nullable Instant publishedAt
) {

    public FoundPatchNote {
        Objects.requireNonNull(externalId, "externalId");
        Objects.requireNonNull(url, "url");
        Objects.requireNonNull(channel, "channel");
    }
}
