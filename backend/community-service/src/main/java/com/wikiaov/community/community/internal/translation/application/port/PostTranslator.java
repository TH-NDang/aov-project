package com.wikiaov.community.community.internal.translation.application.port;

import com.wikiaov.community.community.internal.translation.domain.TranslatedPost;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** The model that translates a post (ADR-037). */
public interface PostTranslator {
    /**
     * One call.
     *
     * @param target
     *            the language to write in; the answer's schema allows only this one
     * @param system
     *            the rules and the post's glossary
     * @param text
     *            the post, sent after its images
     * @param retry
     *            a first answer and what its checks found, for a second call; null on the first
     */
    Result translate(String target, String system, String text, List<Image> images, @Nullable Retry retry);

    /** An image as downloaded, with its type read from its first bytes. */
    record Image(
            byte[] data,
            String mediaType
    ) {
    }

    record Retry(
            String previousAnswer,
            String failures
    ) {
    }

    /**
     * @param raw
     *            the answer as sent, for a retry
     */
    record Result(
            TranslatedPost post,
            String raw,
            String model,
            long inputTokens,
            long outputTokens
    ) {
    }

    /** The API could not be reached, refused the call or answered something that does not fit the schema. */
    class Failed extends RuntimeException {
        public Failed(String message, @Nullable Throwable cause) {
            super(message, cause);
        }
    }
}
