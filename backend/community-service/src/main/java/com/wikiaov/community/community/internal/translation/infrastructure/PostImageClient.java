package com.wikiaov.community.community.internal.translation.infrastructure;

import com.wikiaov.community.community.internal.translation.application.TranslationSettings;
import com.wikiaov.community.community.internal.translation.application.port.PostImages;
import com.wikiaov.community.community.internal.translation.application.port.PostTranslator;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Downloads post images from the site's own image hosts only, so a post cannot make the service fetch an address of
 * its choosing. Redirects are not followed, and an image is read up to the API's size limit.
 */
@Component
class PostImageClient implements PostImages {
    private static final Logger log = LoggerFactory.getLogger(PostImageClient.class);

    private final RestClient client;
    private final TranslationSettings settings;

    PostImageClient(TranslationSettings settings) {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NEVER).connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.client = RestClient.builder().requestFactory(factory).build();
        this.settings = settings;
    }

    @Override
    public List<Optional<PostTranslator.Image>> load(List<String> urls) {
        return urls.stream().map(this::load).toList();
    }

    private Optional<PostTranslator.Image> load(String url) {
        var uri = allowed(url, settings.imageHosts());
        if (uri == null) {
            return Optional.empty();
        }
        try {
            byte[] data = client.get().uri(uri).exchange((request, response) -> {
                if (!response.getStatusCode().is2xxSuccessful()) {
                    return null;
                }
                try (InputStream body = response.getBody()) {
                    byte[] read = body.readNBytes(settings.maxImageBytes() + 1);
                    return read.length > settings.maxImageBytes() ? null : read;
                }
            });
            String type = data == null ? null : mediaType(data);
            return type == null ? Optional.empty() : Optional.of(new PostTranslator.Image(data, type));
        } catch (RestClientException failure) {
            log.warn("Could not read a post image from {} for translation: {}", uri.getHost(),
                    failure.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    /** The image's address when it is HTTPS on an allowed host; plain HTTP only for a local host. */
    static @Nullable URI allowed(String url, List<String> hosts) {
        URI uri;
        try {
            uri = URI.create(url.strip());
        } catch (IllegalArgumentException malformed) {
            return null;
        }
        String host = uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT);
        if (host == null || uri.getUserInfo() != null || !hosts.contains(host)) {
            return null;
        }
        boolean local = host.equals("localhost") || host.equals("127.0.0.1");
        return "https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme())) ? uri : null;
    }

    /** JPEG, PNG, GIF or WebP, told from the first bytes rather than the server's word. */
    static @Nullable String mediaType(byte[] data) {
        if (starts(data, 0xFF, 0xD8, 0xFF)) {
            return "image/jpeg";
        }
        if (starts(data, 0x89, 'P', 'N', 'G')) {
            return "image/png";
        }
        if (starts(data, 'G', 'I', 'F', '8')) {
            return "image/gif";
        }
        if (data.length >= 12 && starts(data, 'R', 'I', 'F', 'F') && data[8] == 'W' && data[9] == 'E'
                && data[10] == 'B' && data[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    private static boolean starts(byte[] data, int... prefix) {
        if (data.length < prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if ((data[i] & 0xFF) != prefix[i]) {
                return false;
            }
        }
        return true;
    }
}
