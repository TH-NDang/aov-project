package com.wikiaov.media.internal.upload.infrastructure;

import com.wikiaov.media.internal.upload.application.port.ResizedCopies;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Requests each configured width of a new picture through Cloudflare's image transformations on the media host, in
 * the exact form the Wiki uses ({@code sized-image.ts}), so the copy is in Cloudflare's cache before a reader asks
 * for it. With Tiered Cache on, the copy is kept in the upper tier that every location asks first.
 */
@Component
@EnableConfigurationProperties(MediaWarmProperties.class)
class CloudflareResizedCopies implements ResizedCopies {
    private static final Logger log = LoggerFactory.getLogger(CloudflareResizedCopies.class);
    /** The options after the width; they must stay those of resizedImageUrl in the Wiki. */
    static final String OPTIONS = "fit=scale-down,format=auto,quality=82";

    private final MediaWarmProperties properties;
    private final HttpClient client;
    private final Executor executor;

    @Autowired
    CloudflareResizedCopies(MediaWarmProperties properties) {
        this(properties, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NEVER).build(), Executors.newVirtualThreadPerTaskExecutor());
    }

    CloudflareResizedCopies(MediaWarmProperties properties, HttpClient client, Executor executor) {
        this.properties = properties;
        this.client = client;
        this.executor = executor;
    }

    @Override
    public void warm(String publicUrl) {
        if (properties.widths().isEmpty()) {
            return;
        }
        URI picture;
        try {
            picture = URI.create(publicUrl);
        } catch (IllegalArgumentException e) {
            return;
        }
        // Only pictures the Wiki resizes: absolute, on http(s), under assets/.
        if (!"https".equals(picture.getScheme()) && !"http".equals(picture.getScheme()) || picture.getHost() == null
                || picture.getRawPath() == null || !picture.getRawPath().startsWith("/assets/")) {
            return;
        }
        executor.execute(() -> {
            for (int width : properties.widths()) {
                for (String accept : properties.accept()) {
                    request(copyOf(picture, width), accept);
                }
            }
        });
    }

    static URI copyOf(URI picture, int width) {
        return URI.create(picture.getScheme() + "://" + picture.getRawAuthority() + "/cdn-cgi/image/width=" + width
                + "," + OPTIONS + picture.getRawPath());
    }

    private void request(URI copy, String accept) {
        try {
            var response = client.send(HttpRequest.newBuilder(copy).timeout(Duration.ofSeconds(30))
                    .header("Accept", accept).GET().build(), HttpResponse.BodyHandlers.discarding());
            if (response.statusCode() != 200) {
                log.warn("Making the resized copy {} answered {}", copy, response.statusCode());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Could not make the resized copy {}: {}", copy, e.toString());
        }
    }
}
