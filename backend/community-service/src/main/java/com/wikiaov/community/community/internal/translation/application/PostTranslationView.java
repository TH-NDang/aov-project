package com.wikiaov.community.community.internal.translation.application;

import com.wikiaov.community.community.internal.translation.domain.TranslatedPost;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A post in the reader's language.
 *
 * @param sourceLanguage
 *            the language the post is written in, as far as the service could tell; null when it could not
 * @param sameLanguage
 *            the post is already in the requested language, so {@code title} and {@code body} are its own
 * @param images
 *            what each image says, in the post's order; empty when the post was not sent to the model
 * @param model
 *            the model that translated it; null when nothing was translated
 */
public record PostTranslationView(
        UUID postId,
        String locale,
        @Nullable String sourceLanguage,
        boolean sameLanguage,
        @Nullable String title,
        String body,
        List<Image> images,
        @Nullable String model
) {
    /**
     * @param text
     *            what the image says in the requested language; null when it shows no readable words
     */
    public record Image(
            int index,
            boolean hasText,
            @Nullable String language,
            @Nullable String text
    ) {
    }

    static PostTranslationView of(UUID postId, String locale, TranslatedPost post, String model) {
        return new PostTranslationView(postId, locale, post.sourceLanguage(),
                post.sourceLanguage().equals(locale), post.title(), post.body(),
                post.images().stream().map(image -> new Image(image.index(), image.hasText(), image.language(),
                        image.hasText() ? image.text() : null)).toList(),
                model);
    }
}
