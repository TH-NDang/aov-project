package com.wikiaov.media.internal.upload.infrastructure;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Resized copies made right after an upload ({@code wiki.media.warm.*}).
 *
 * @param widths the widths to make, as the Wiki asks for them (sized-image.ts); empty makes none
 * @param accept the image formats to make each width in, one request per {@code Accept} value
 */
@ConfigurationProperties("wiki.media.warm")
record MediaWarmProperties(
        @DefaultValue List<Integer> widths,
        @DefaultValue({
                "image/avif,image/webp,*/*", "image/webp,*/*"}) List<String> accept
) {
}
