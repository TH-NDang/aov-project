package com.wikiaov.media.internal.upload.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.net.URI;
import java.net.http.HttpClient;
import java.util.List;
import org.junit.jupiter.api.Test;

class CloudflareResizedCopiesTest {
    private final HttpClient client = mock(HttpClient.class);

    private CloudflareResizedCopies copies(List<Integer> widths) {
        return new CloudflareResizedCopies(new MediaWarmProperties(widths, List.of("image/avif,*/*", "image/webp,*/*")),
                client, Runnable::run);
    }

    @Test
    void aCopyIsAskedForAsTheWikiAsksForIt() {
        assertThat(CloudflareResizedCopies.copyOf(URI.create("https://img.athahub.com/assets/a1/b2.png"), 768))
                .hasToString("https://img.athahub.com/cdn-cgi/image/width=768,fit=scale-down,format=auto,quality=82"
                        + "/assets/a1/b2.png");
    }

    @Test
    void everyWidthIsMadeInEveryFormat() throws Exception {
        copies(List.of(128, 768)).warm("https://img.athahub.com/assets/a1/b2.png");

        verify(client, times(4)).send(any(), any());
    }

    @Test
    void nothingIsMadeWithoutWidthsOrForAPictureTheWikiDoesNotResize() throws Exception {
        copies(List.of()).warm("https://img.athahub.com/assets/a1/b2.png");
        copies(List.of(128)).warm("/media/assets/a1/b2.png");
        copies(List.of(128)).warm("https://img.athahub.com/other/b2.png");

        verify(client, never()).send(any(), any());
    }
}
