package com.wikiaov.video.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class VideoLinkTest {
    private static final String WATCH = "https://www.youtube.com/watch?v=yISPe_EM4sQ";

    @ParameterizedTest
    @ValueSource(strings = {
            "https://www.youtube.com/watch?v=yISPe_EM4sQ",
            "http://youtube.com/watch?list=abc&v=yISPe_EM4sQ",
            "https://m.youtube.com/watch?v=yISPe_EM4sQ",
            "https://music.youtube.com/watch?v=yISPe_EM4sQ",
            "https://youtu.be/yISPe_EM4sQ",
            "https://www.youtube.com/shorts/yISPe_EM4sQ",
            "https://www.youtube.com/embed/yISPe_EM4sQ",
            "https://www.youtube-nocookie.com/embed/yISPe_EM4sQ",
            "https://www.youtube.com/live/yISPe_EM4sQ?si=abc",
            "  https://youtu.be/yISPe_EM4sQ  "
    })
    void everyYoutubeFormBecomesOneWatchLink(String pasted) {
        var link = VideoLink.parse(pasted).orElseThrow();

        assertThat(link.url()).isEqualTo(WATCH);
        assertThat(link.provider()).isEqualTo(VideoProvider.YOUTUBE);
        assertThat(link.providerVideoId()).isEqualTo("yISPe_EM4sQ");
        assertThat(link.startSeconds()).isZero();
    }

    @Test
    void readsTheStartPointFromTheLink() {
        assertThat(VideoLink.parse("https://youtu.be/yISPe_EM4sQ?t=90").orElseThrow().startSeconds()).isEqualTo(90);
        assertThat(VideoLink.parse("https://youtu.be/yISPe_EM4sQ?t=90s").orElseThrow().startSeconds()).isEqualTo(90);
        assertThat(VideoLink.parse("https://youtu.be/yISPe_EM4sQ?t=1h2m3s").orElseThrow().startSeconds())
                .isEqualTo(3723);
        assertThat(VideoLink.parse(WATCH + "&start=15").orElseThrow().startSeconds()).isEqualTo(15);
        assertThat(VideoLink.parse(WATCH + "&t=later").orElseThrow().startSeconds()).isZero();
    }

    @Test
    void otherPlatformsStayLinksThatAreNotEmbedded() {
        var facebook = VideoLink.parse("https://www.facebook.com/lienquan/videos/123").orElseThrow();
        assertThat(facebook.provider()).isEqualTo(VideoProvider.FACEBOOK);
        assertThat(facebook.providerVideoId()).isNull();
        assertThat(facebook.url()).isEqualTo("https://www.facebook.com/lienquan/videos/123");

        assertThat(VideoLink.parse("https://fb.watch/abc/").orElseThrow().provider())
                .isEqualTo(VideoProvider.FACEBOOK);
        assertThat(VideoLink.parse("https://www.tiktok.com/@a/video/1").orElseThrow().provider())
                .isEqualTo(VideoProvider.TIKTOK);
        assertThat(VideoLink.parse("https://www.twitch.tv/videos/1").orElseThrow().provider())
                .isEqualTo(VideoProvider.TWITCH);
        assertThat(VideoLink.parse("https://example.com/v.mp4").orElseThrow().provider())
                .isEqualTo(VideoProvider.OTHER);
    }

    @Test
    void aLookalikeHostIsNotTreatedAsYoutube() {
        var link = VideoLink.parse("https://notyoutube.com/watch?v=yISPe_EM4sQ").orElseThrow();

        assertThat(link.provider()).isEqualTo(VideoProvider.OTHER);
        assertThat(link.providerVideoId()).isNull();
    }

    @Test
    void aYoutubePageWithoutOneVideoIsKeptAsALink() {
        var channel = VideoLink.parse("https://www.youtube.com/@garena").orElseThrow();

        assertThat(channel.provider()).isEqualTo(VideoProvider.YOUTUBE);
        assertThat(channel.providerVideoId()).isNull();
        assertThat(channel.url()).isEqualTo("https://www.youtube.com/@garena");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "not a link", "javascript:alert(1)", "ftp://youtu.be/yISPe_EM4sQ",
            "//youtu.be/yISPe_EM4sQ", "data:text/html,hello"})
    void rejectsAnythingThatIsNotAnAbsoluteWebLink(String pasted) {
        assertThat(VideoLink.parse(pasted)).isEmpty();
    }

    @Test
    void rejectsMissingAndOverlongLinks() {
        assertThat(VideoLink.parse(null)).isEmpty();
        assertThat(VideoLink.parse("https://example.com/" + "a".repeat(VideoLink.MAX_URL_LENGTH))).isEmpty();
    }
}
