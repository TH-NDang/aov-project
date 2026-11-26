package com.wikiaov.community.community.internal.channels.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import com.sun.net.httpserver.HttpServer;
import com.wikiaov.community.community.internal.channels.application.ChannelViews.Broadcast;
import com.wikiaov.community.community.internal.channels.application.YouTubeSettings;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Unavailable;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Upload;
import com.wikiaov.community.community.internal.channels.domain.ChannelAddress;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class YouTubeClientTest {
    static final String KEY = "test-key-never-in-the-address";
    static final String CHANNEL = "UCgYkGvtBuY4onYm2Eh61zwQ";
    final Map<String, String> queries = new ConcurrentHashMap<>();
    final Map<String, String> keys = new ConcurrentHashMap<>();
    final Map<String, Answer> answers = new ConcurrentHashMap<>();
    HttpServer server;
    YouTubeClient client;

    record Answer(
            int status,
            String type,
            String body
    ) {
    }

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            var path = exchange.getRequestURI().getPath();
            var query = exchange.getRequestURI().getRawQuery();
            queries.put(path, query == null ? "" : URLDecoder.decode(query, StandardCharsets.UTF_8));
            var key = exchange.getRequestHeaders().getFirst("X-Goog-Api-Key");
            keys.put(path, key == null ? "" : key);
            var answer = answers.getOrDefault(path, new Answer(404, "application/json", "{}"));
            var bytes = answer.body().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", answer.type());
            exchange.sendResponseHeaders(answer.status(), bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        client = client(KEY);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    YouTubeClient client(String key) {
        var base = "http://127.0.0.1:" + server.getAddress().getPort();
        return new YouTubeClient(new YouTubeSettings(key, base + "/youtube/v3", base + "/feeds/videos.xml", 100,
                Duration.ofHours(1), Duration.ofMinutes(30)));
    }

    @Test
    void aHandleIsLookedUpWithTheKeyInAHeaderOnly() {
        answers.put("/youtube/v3/channels", json("""
                {"items":[{"id":"%s",
                  "snippet":{"title":"Garena Liên Quân Mobile","description":"  Kênh chính thức  ","customUrl":"@garenalienquan",
                    "thumbnails":{"default":{"url":"https://yt3.ggpht.com/a=s88"},"medium":{"url":"https://yt3.ggpht.com/a=s240"}}},
                  "statistics":{"subscriberCount":"1530000","hiddenSubscriberCount":false,"videoCount":"4210"},
                  "brandingSettings":{"image":{"bannerExternalUrl":"https://yt3.googleusercontent.com/banner"}}}]}
                """.formatted(CHANNEL)));

        var facts = client.channel(new ChannelAddress(ChannelAddress.Kind.HANDLE, "GarenaLiênQuân")).orElseThrow();

        assertThat(facts.id()).isEqualTo(CHANNEL);
        assertThat(facts.title()).isEqualTo("Garena Liên Quân Mobile");
        assertThat(facts.handle()).isEqualTo("@garenalienquan");
        assertThat(facts.description()).isEqualTo("Kênh chính thức");
        assertThat(facts.avatarUrl()).isEqualTo("https://yt3.ggpht.com/a=s240");
        assertThat(facts.bannerUrl()).startsWith("https://yt3.googleusercontent.com/banner=w1280-");
        assertThat(facts.subscriberCount()).isEqualTo(1_530_000L);
        assertThat(facts.videoCount()).isEqualTo(4210L);
        assertThat(queries.get("/youtube/v3/channels")).contains("forHandle=GarenaLiênQuân")
                .doesNotContain(KEY);
        assertThat(keys.get("/youtube/v3/channels")).isEqualTo(KEY);
    }

    @Test
    void aHiddenSubscriberCountIsNotShown() {
        answers.put("/youtube/v3/channels", json("""
                {"items":[{"id":"%s","snippet":{"title":"Team"},
                  "statistics":{"subscriberCount":"100","hiddenSubscriberCount":true,"videoCount":"3"}}]}
                """.formatted(CHANNEL)));

        var facts = client.channel(new ChannelAddress(ChannelAddress.Kind.ID, CHANNEL)).orElseThrow();

        assertThat(facts.subscriberCount()).isNull();
        assertThat(facts.bannerUrl()).isNull();
        assertThat(queries.get("/youtube/v3/channels")).contains("id=" + CHANNEL);
    }

    @Test
    void anUnknownHandleIsNoChannel() {
        answers.put("/youtube/v3/channels", json("{\"kind\":\"youtube#channelListResponse\"}"));

        assertThat(client.channel(new ChannelAddress(ChannelAddress.Kind.HANDLE, "nobody-here"))).isEmpty();
    }

    @Test
    void theFeedGivesTheNewestUploadsWithShortsMarked() {
        answers.put("/feeds/videos.xml", new Answer(200, "text/xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
                 <title>Saigon Phantom</title>
                 <author><name>Saigon Phantom</name></author>
                 <entry>
                  <id>yt:video:AAAAAAAAAAA</id>
                  <yt:videoId>AAAAAAAAAAA</yt:videoId>
                  <title>SGP vs FL &amp; highlights</title>
                  <link rel="alternate" href="https://www.youtube.com/watch?v=AAAAAAAAAAA"/>
                  <published>2026-11-25T12:00:00+00:00</published>
                  <media:group><media:title>ignored</media:title>
                   <media:community><media:statistics views="1234"/></media:community></media:group>
                 </entry>
                 <entry>
                  <yt:videoId>BBBBBBBBBBB</yt:videoId>
                  <title>Pentakill</title>
                  <link rel="alternate" href="https://www.youtube.com/shorts/BBBBBBBBBBB"/>
                  <published>2026-11-24T08:30:00+07:00</published>
                 </entry>
                 <entry><yt:videoId>broken</yt:videoId><published>2026-11-24T00:00:00Z</published></entry>
                </feed>
                """));

        var feed = client.feed(CHANNEL).orElseThrow();

        assertThat(feed.title()).isEqualTo("Saigon Phantom");
        assertThat(feed.uploads()).containsExactly(
                new Upload("AAAAAAAAAAA", "SGP vs FL & highlights", Instant.parse("2026-11-25T12:00:00Z"), 1234L,
                        false),
                new Upload("BBBBBBBBBBB", "Pentakill", Instant.parse("2026-11-24T01:30:00Z"), null, true));
        assertThat(queries.get("/feeds/videos.xml")).isEqualTo("channel_id=" + CHANNEL);
    }

    @Test
    void aFeedWithAnExternalEntityIsRefused() {
        answers.put("/feeds/videos.xml", new Answer(200, "text/xml", """
                <?xml version="1.0"?>
                <!DOCTYPE feed [<!ENTITY secret SYSTEM "file:///etc/passwd">]>
                <feed xmlns="http://www.w3.org/2005/Atom"><title>&secret;</title></feed>
                """));

        assertThatThrownBy(() -> client.feed(CHANNEL)).isInstanceOf(Unavailable.class);
    }

    @Test
    void aChannelWithoutFeedHasNone() {
        assertThat(client.feed(CHANNEL)).isEmpty();
    }

    @Test
    void uploadsKeepPublicVideosAndTheNextToken() {
        answers.put("/youtube/v3/playlistItems", json("""
                {"nextPageToken":"EAAaBlBUOkNESQ",
                 "items":[
                  {"snippet":{"title":"Final"},"contentDetails":{"videoId":"CCCCCCCCCCC","videoPublishedAt":"2026-11-20T10:00:00Z"},"status":{"privacyStatus":"public"}},
                  {"snippet":{"title":"Private video"},"contentDetails":{"videoId":"DDDDDDDDDDD"},"status":{"privacyStatus":"private"}},
                  {"snippet":{"title":"Unlisted"},"contentDetails":{"videoId":"EEEEEEEEEEE","videoPublishedAt":"2026-11-19T10:00:00Z"},"status":{"privacyStatus":"unlisted"}}]}
                """));

        var page = client.uploads(CHANNEL, "EAAaBlBUOkNESQ", 24).orElseThrow();

        assertThat(page.uploads()).extracting(Upload::id).containsExactly("CCCCCCCCCCC");
        assertThat(page.nextPageToken()).isEqualTo("EAAaBlBUOkNESQ");
        assertThat(queries.get("/youtube/v3/playlistItems")).contains("playlistId=UUgYkGvtBuY4onYm2Eh61zwQ",
                "maxResults=24", "pageToken=EAAaBlBUOkNESQ");
    }

    @Test
    void videosGiveLengthViewsAndBroadcast() {
        answers.put("/youtube/v3/videos", json("""
                {"items":[
                 {"id":"CCCCCCCCCCC","snippet":{"title":"Final","publishedAt":"2026-11-20T10:00:00Z","liveBroadcastContent":"none"},
                  "contentDetails":{"duration":"PT1H2M3S"},"statistics":{"viewCount":"98765"}},
                 {"id":"FFFFFFFFFFF","snippet":{"title":"Live now","publishedAt":"2026-11-26T10:00:00Z","liveBroadcastContent":"live"},
                  "contentDetails":{"duration":"P0D"}}]}
                """));

        var videos = client.videos(List.of("CCCCCCCCCCC", "FFFFFFFFFFF"));

        assertThat(videos).hasSize(2);
        assertThat(videos.get(0).durationSeconds()).isEqualTo(3723);
        assertThat(videos.get(0).viewCount()).isEqualTo(98_765L);
        assertThat(videos.get(0).broadcast()).isNull();
        assertThat(videos.get(1).durationSeconds()).isNull();
        assertThat(videos.get(1).broadcast()).isEqualTo(Broadcast.LIVE);
        assertThat(queries.get("/youtube/v3/videos")).contains("id=CCCCCCCCCCC,FFFFFFFFFFF");
    }

    @Test
    void aQuotaRefusalIsToldApart() {
        answers.put("/youtube/v3/videos", new Answer(403, "application/json", """
                {"error":{"code":403,"message":"The request cannot be completed because you have exceeded your quota.",
                  "errors":[{"reason":"quotaExceeded","domain":"youtube.quota"}]}}
                """));

        var failure = catchThrowableOfType(Unavailable.class, () -> client.videos(List.of("CCCCCCCCCCC")));

        assertThat(failure.quota()).isTrue();
        assertThat(failure.getMessage()).contains("403", "quotaExceeded").doesNotContain(KEY);
    }

    @Test
    void anotherRefusalIsNotAQuotaOne() {
        answers.put("/youtube/v3/channels", new Answer(400, "application/json", """
                {"error":{"code":400,"errors":[{"reason":"badRequest"}],"status":"INVALID_ARGUMENT"}}
                """));

        var failure = catchThrowableOfType(Unavailable.class,
                () -> client.channel(new ChannelAddress(ChannelAddress.Kind.ID, CHANNEL)));

        assertThat(failure.quota()).isFalse();
    }

    @Test
    void withoutAKeyNoKeyHeaderIsSent() {
        var keyless = client("");
        answers.put("/youtube/v3/channels", json("{\"items\":[]}"));

        keyless.channel(new ChannelAddress(ChannelAddress.Kind.ID, CHANNEL));

        assertThat(keyless.dataApi()).isFalse();
        assertThat(keys.get("/youtube/v3/channels")).isEmpty();
    }

    @Test
    void lengthsReadAsSeconds() {
        assertThat(YouTubeClient.seconds("PT45S")).isEqualTo(45);
        assertThat(YouTubeClient.seconds("P1DT1S")).isEqualTo(86_401);
        assertThat(YouTubeClient.seconds("P0D")).isNull();
        assertThat(YouTubeClient.seconds("nonsense")).isNull();
    }

    static Answer json(String body) {
        return new Answer(200, "application/json", body);
    }
}
