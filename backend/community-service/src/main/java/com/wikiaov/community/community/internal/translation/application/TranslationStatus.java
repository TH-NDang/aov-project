package com.wikiaov.community.community.internal.translation.application;

import java.util.List;

/**
 * Whether posts can be translated now, so Stream shows its Translate button only then.
 *
 * @param enabled
 *            an API key is set and this month's budget is not spent
 * @param locales
 *            the languages posts are translated into
 */
public record TranslationStatus(
        boolean enabled,
        List<String> locales
) {
}
