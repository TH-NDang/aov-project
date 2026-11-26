package com.wikiaov.patch.internal.watch.infrastructure;

import com.wikiaov.patch.internal.watch.application.PatchWatchProperties;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeed;
import com.wikiaov.patch.internal.watch.application.port.PatchNoteFeedException;
import com.wikiaov.patch.internal.watch.domain.FoundPatchNote;
import com.wikiaov.patch.internal.watch.domain.PatchNoteFailure;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Downloads the publishers' lists with plain GETs: one page per source, a conditional request when the last answer
 * carried validators, a size cap, and no cookies. The Indonesian list comes from the server's page reader instead.
 */
@Component
@EnableConfigurationProperties(PatchWatchProperties.class)
class HttpPatchNoteFeed implements PatchNoteFeed {
    private static final Logger LOG = LoggerFactory.getLogger(HttpPatchNoteFeed.class);
    private static final int MAX_BYTES = 4 * 1024 * 1024;
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(30);
    /** The page reader starts a browser and waits for the page's scripts. */
    private static final Duration RENDER_TIMEOUT = Duration.ofSeconds(90);
    private static final Pattern CHARSET = Pattern.compile("charset=\"?([\\w.:-]+)", Pattern.CASE_INSENSITIVE);
    /** The one page the page reader opens; it renders nothing else (infra/page-reader). */
    static final String RENDERED_PAGE = "garena-id-news";

    private final PatchWatchProperties properties;
    private final Clock clock;
    private final HttpClient client;

    @Autowired
    HttpPatchNoteFeed(PatchWatchProperties properties, Clock clock) {
        this(properties, clock, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL).build());
    }

    HttpPatchNoteFeed(PatchWatchProperties properties, Clock clock, HttpClient client) {
        this.properties = properties;
        this.clock = clock;
        this.client = client;
    }

    @Override
    public Answer read(PatchNoteSource source, Validators validators) {
        boolean rendered = source.needsPageReader();
        HttpRequest.Builder request = HttpRequest.newBuilder(listAddress(source))
                .timeout(rendered ? RENDER_TIMEOUT : READ_TIMEOUT)
                .header("User-Agent", properties.userAgent())
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .GET();
        if (!rendered && validators.etag() != null) {
            request.header("If-None-Match", validators.etag());
        }
        if (!rendered && validators.lastModified() != null) {
            request.header("If-Modified-Since", validators.lastModified());
        }

        HttpResponse<InputStream> response = send(request.build());
        int status = response.statusCode();
        if (status == 304) {
            close(response);
            return Answer.unchanged();
        }
        if (status != 200) {
            close(response);
            throw new PatchNoteFeedException(PatchNoteFailure.HTTP_STATUS, status);
        }

        String body = body(response);
        List<FoundPatchNote> posts = PatchNoteParsers.parse(source, body, LocalDate.now(clock.withZone(zoneOf(
                source))));
        if (posts.isEmpty()) {
            throw new PatchNoteFeedException(PatchNoteFailure.UNREADABLE, null);
        }
        return new Answer(false, posts, response.headers().firstValue("ETag").orElse(null),
                response.headers().firstValue("Last-Modified").orElse(null));
    }

    @Override
    public @Nullable String title(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(READ_TIMEOUT)
                    .header("User-Agent", properties.userAgent()).header("Accept", "text/html").GET().build();
            HttpResponse<InputStream> response = send(request);
            if (response.statusCode() != 200) {
                close(response);
                return null;
            }
            return PatchNoteParsers.title(body(response));
        } catch (PatchNoteFeedException | IllegalArgumentException ex) {
            LOG.debug("Patch watch could not name a post: {}", ex.getClass().getSimpleName());
            return null;
        }
    }

    private URI listAddress(PatchNoteSource source) {
        if (source.needsPageReader()) {
            String base = properties.pageReaderUrl().replaceAll("/+$", "");
            return URI.create(base + "/render?page=" + RENDERED_PAGE);
        }
        return URI.create(Objects.requireNonNull(source.listUrl(), "listUrl"));
    }

    private HttpResponse<InputStream> send(HttpRequest request) {
        try {
            return client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException ex) {
            throw new PatchNoteFeedException(PatchNoteFailure.UNREACHABLE, null);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new PatchNoteFeedException(PatchNoteFailure.UNREACHABLE, null);
        }
    }

    private static String body(HttpResponse<InputStream> response) {
        try (InputStream in = response.body()) {
            byte[] bytes = in.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) {
                throw new PatchNoteFeedException(PatchNoteFailure.TOO_LARGE, null);
            }
            return new String(bytes, charset(response.headers().firstValue("Content-Type").orElse("")));
        } catch (IOException ex) {
            throw new PatchNoteFeedException(PatchNoteFailure.UNREACHABLE, null);
        }
    }

    private static Charset charset(String contentType) {
        Matcher matcher = CHARSET.matcher(contentType);
        if (matcher.find()) {
            try {
                return Charset.forName(matcher.group(1));
            } catch (IllegalArgumentException ex) {
                return StandardCharsets.UTF_8;
            }
        }
        return StandardCharsets.UTF_8;
    }

    private static void close(HttpResponse<InputStream> response) {
        try {
            response.body().close();
        } catch (IOException ex) {
            LOG.debug("Patch watch could not close a response: {}", ex.getClass().getSimpleName());
        }
    }

    private static ZoneId zoneOf(PatchNoteSource source) {
        return switch (source.region()) {
            case TW -> PatchNoteParsers.TAIPEI;
            case ID -> PatchNoteParsers.JAKARTA;
            default -> ZoneId.of("Asia/Ho_Chi_Minh");
        };
    }
}
