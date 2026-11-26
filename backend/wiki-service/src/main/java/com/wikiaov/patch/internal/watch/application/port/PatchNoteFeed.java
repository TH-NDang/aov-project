package com.wikiaov.patch.internal.watch.application.port;

import com.wikiaov.patch.internal.watch.domain.FoundPatchNote;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Reads a publisher's list of patch notes over HTTP. */
public interface PatchNoteFeed {

    /**
     * Reads the list of {@code source}, asking the server to answer "not modified" when the given validators still
     * match.
     *
     * @throws PatchNoteFeedException when the list cannot be read
     */
    Answer read(PatchNoteSource source, Validators validators);

    /** The title of one post page, or null when it cannot be read. Used for lists that carry links only. */
    @Nullable
    String title(String url);

    /** The cache validators of the last answer, sent back so an unchanged list costs the server nothing. */
    record Validators(
            @Nullable String etag,
            @Nullable String lastModified
    ) {
    }

    /**
     * @param notModified true when the server confirmed the list has not changed; {@code posts} is then empty
     */
    record Answer(
            boolean notModified,
            List<FoundPatchNote> posts,
            @Nullable String etag,
            @Nullable String lastModified
    ) {

        public Answer {
            posts = List.copyOf(posts);
        }

        public static Answer unchanged() {
            return new Answer(true, List.of(), null, null);
        }
    }
}
