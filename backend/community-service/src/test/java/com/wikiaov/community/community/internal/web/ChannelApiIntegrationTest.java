package com.wikiaov.community.community.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static com.wikiaov.community.testsupport.ApiCalls.ROOT;
import static com.wikiaov.community.testsupport.ApiCalls.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.ChannelFacts;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Feed;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.Upload;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.UploadPage;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource.VideoFacts;
import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** A page's YouTube channel read through the public HTTP API, with YouTube itself stubbed (ADR-034). */
@CommunityApplicationTest
class ChannelApiIntegrationTest {
    private static final String EDITOR = "editor";
    private static final String[] CAPABILITIES = {"tournament:read", "tournament:write", "tournament:publish"};
    private static final String CHANNEL = "UCgYkGvtBuY4onYm2Eh61zwQ";
    private static final Instant AT = Instant.parse("2026-11-25T12:00:00Z");

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;
    @MockitoBean
    YouTubeSource youtube;

    private ApiCalls api;
    private String link;

    @BeforeEach
    void stub() {
        api = new ApiCalls(mvc, json);
        link = "https://www.youtube.com/@channel-" + UUID.randomUUID().toString().substring(0, 8);
        when(youtube.dataApi()).thenReturn(true);
        when(youtube.channel(any())).thenReturn(Optional.of(new ChannelFacts(CHANNEL, "Saigon Phantom",
                "@saigonphantom", "Official channel", "https://yt3.ggpht.com/a", null, 52_000L, 300L)));
        when(youtube.feed(CHANNEL))
                .thenReturn(Optional.of(new Feed("Saigon Phantom", List.of(new Upload("AAAAAAAAAAA", "Final", AT,
                        12L, false)))));
        when(youtube.videos(anyCollection()))
                .thenReturn(List.of(new VideoFacts("AAAAAAAAAAA", "Final", AT, 600, 15L, null)));
        when(youtube.uploads(eq(CHANNEL), isNull(), anyInt())).thenReturn(Optional.of(new UploadPage(
                List.of(new Upload("AAAAAAAAAAA", "Final", AT, null, false)), "NEXT")));
    }

    @Test
    void aPublishedPageShowsItsChannelWithTheNewestVideos() throws Exception {
        var page = publishedPage(link);

        var channel = read(ROOT + "/pages/" + page + "/youtube-channel", link, 200);

        assertThat(channel.path("id").asString()).isEqualTo(CHANNEL);
        assertThat(channel.path("title").asString()).isEqualTo("Saigon Phantom");
        assertThat(channel.path("handle").asString()).isEqualTo("@saigonphantom");
        assertThat(channel.path("subscriberCount").asLong()).isEqualTo(52_000L);
        assertThat(channel.path("bannerUrl").isNull()).isTrue();
        assertThat(channel.path("url").asString()).isEqualTo("https://www.youtube.com/channel/" + CHANNEL);
        assertThat(channel.path("more").asBoolean()).isTrue();
        var video = channel.path("videos").get(0);
        assertThat(video.path("id").asString()).isEqualTo("AAAAAAAAAAA");
        assertThat(video.path("durationSeconds").asInt()).isEqualTo(600);
        assertThat(video.path("publishedAt").asString()).isEqualTo("2026-11-25T12:00:00Z");
        mvc.perform(get(ROOT + "/pages/" + page + "/youtube-channel").param("url", link))
                .andExpect(header().string("Cache-Control", "max-age=300, public"));
    }

    @Test
    void olderVideosComeWithTheTokenOfTheNextPart() throws Exception {
        var page = publishedPage(link);

        var videos = read(ROOT + "/pages/" + page + "/youtube-channel/videos", link, 200);

        assertThat(videos.path("videos").get(0).path("id").asString()).isEqualTo("AAAAAAAAAAA");
        assertThat(videos.path("nextPageToken").asString()).isEqualTo("NEXT");
    }

    @Test
    void aLinkThePageDoesNotListIsNotFound() throws Exception {
        var page = publishedPage(link);

        var problem = read(ROOT + "/pages/" + page + "/youtube-channel", "https://www.youtube.com/@elsewhere", 404);

        assertThat(problem.path("code").asString()).isEqualTo("CHANNEL_NOT_FOUND");
    }

    @Test
    void aDraftPageShowsNoChannel() throws Exception {
        var draft = api.send(as(post(ADMIN + "/pages"), EDITOR, CAPABILITIES), Map.of("kind", "PERSON", "code",
                "draft-" + UUID.randomUUID(), "content", content(link)), 200).path("id").asString();

        var problem = read(ROOT + "/pages/" + draft + "/youtube-channel", link, 404);

        assertThat(problem.path("code").asString()).isEqualTo("PAGE_NOT_FOUND");
    }

    @Test
    void anUnknownQueryParameterIsRefused() throws Exception {
        var page = publishedPage(link);

        api.send(get(ROOT + "/pages/" + page + "/youtube-channel").param("url", link).param("size", "5"), null, 400);
    }

    private JsonNode read(String path, String url, int status) throws Exception {
        return api.send(get(path).param("url", url), null, status);
    }

    private String publishedPage(String url) throws Exception {
        var created = api.send(as(post(ADMIN + "/pages"), EDITOR, CAPABILITIES), Map.of("kind", "PERSON", "code",
                "caster-" + UUID.randomUUID(), "content", content(url)), 200);
        var id = created.path("id").asString();
        api.send(as(post(ADMIN + "/pages/" + id + "/publish"), EDITOR, CAPABILITIES),
                Map.of("version", created.path("version").asLong()), 200);
        return id;
    }

    private static Map<String, Object> content(String url) {
        return Map.of("name", "Caster", "personRoles", List.of("CASTER"), "links",
                List.of(Map.of("label", "YouTube", "url", url, "official", true)), "sources",
                List.of(Map.of("label", "Liquipedia", "url", "https://liquipedia.net/arenaofvalor/Caster")));
    }
}
