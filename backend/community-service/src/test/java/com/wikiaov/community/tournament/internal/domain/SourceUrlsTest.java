package com.wikiaov.community.tournament.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class SourceUrlsTest {
    @Test
    void optionalValuesAndAbsoluteWebSourcesAreAllowed() {
        assertThat(SourceUrls.valid(null)).isTrue();
        assertThat(SourceUrls.valid("")).isTrue();
        assertThat(SourceUrls.valid("  ")).isTrue();
        for (var url : List.of("https://www.youtube.com/watch?v=sample&t=10s",
                "https://img.athahub.com/assets/image.webp", "http://localhost:5174/matches?id=one#draft",
                "HTTPS://example.com/video"))
            assertThat(SourceUrls.valid(url)).as(url).isTrue();
    }

    @Test
    void ExecutableRelativeAndCredentialBearingValuesAreRejected() {
        for (var url : List.of("javascript:alert(1)", "data:text/html,test", "//example.com/file", "/relative.png",
                "https://user:password@example.com/image.png", "https://example.com\\evil",
                "https://example.com/\nvideo", "https://example.com/\tvideo", " https://example.com ", "https://",
                "file:///C:/image.jpg", "https://example.com/" + "a".repeat(2048)))
            assertThat(SourceUrls.valid(url)).as(url).isFalse();
    }
}
