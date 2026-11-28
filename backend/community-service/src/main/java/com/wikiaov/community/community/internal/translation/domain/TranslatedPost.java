package com.wikiaov.community.community.internal.translation.domain;

import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * A post in another language, as the model answered it.
 *
 * @param sourceLanguage
 *            the language the model read the body in, one of {@link TranslationLanguages#SOURCES}
 * @param images
 *            one entry per image, in the order of the post
 */
public record TranslatedPost(
        String sourceLanguage,
        @Nullable String title,
        String body,
        List<ImageText> images
) {
    public TranslatedPost {
        body = body == null ? "" : body;
        images = images == null ? List.of() : List.copyOf(images);
    }

    /**
     * What one image says.
     *
     * @param hasText
     *            whether the image shows readable words
     * @param language
     *            the language of those words, null without any
     * @param text
     *            what the image says, in the target language; null without readable words
     */
    public record ImageText(
            int index,
            boolean hasText,
            @Nullable String language,
            @Nullable String text
    ) {
    }
}
