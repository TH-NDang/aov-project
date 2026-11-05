package com.wikiaov.community.community.internal.domain;

import java.util.List;

/**
 * What an author writes in a post. {@code kind} is TEXT, NEWS (needs a title) or VIDEO (needs a video link and may
 * have no text); up to four images go with any kind.
 */
public record PostContent(
        String kind,
        String title,
        String body,
        String videoUrl,
        List<String> imageUrls
) {
}
