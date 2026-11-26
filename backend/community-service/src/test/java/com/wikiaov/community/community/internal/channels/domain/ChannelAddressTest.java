package com.wikiaov.community.community.internal.channels.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.community.internal.channels.domain.ChannelAddress.Kind;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class ChannelAddressTest {
    @ParameterizedTest
    @CsvSource({
            "https://www.youtube.com/channel/UCgYkGvtBuY4onYm2Eh61zwQ, ID, UCgYkGvtBuY4onYm2Eh61zwQ",
            "https://youtube.com/channel/UCgYkGvtBuY4onYm2Eh61zwQ/videos, ID, UCgYkGvtBuY4onYm2Eh61zwQ",
            "https://www.youtube.com/@GarenaLienQuan, HANDLE, GarenaLienQuan",
            "https://m.youtube.com/@saigon.phantom/featured?si=abc, HANDLE, saigon.phantom",
            "https://www.youtube.com/user/garenavn, USERNAME, garenavn",
            "https://www.youtube.com/c/LienQuanMobile, HANDLE, LienQuanMobile",
            "https://www.youtube.com/teamflash, HANDLE, teamflash",
            "http://www.youtube.com/@one_star-esports, HANDLE, one_star-esports"
    })
    void aChannelLinkNamesItsChannel(String url, Kind kind, String value) {
        assertThat(ChannelAddress.of(url)).contains(new ChannelAddress(kind, value));
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ",
            "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/playlist?list=PL123",
            "https://www.youtube.com/", "https://www.youtube.com/channel/UC123", "https://www.facebook.com/@team",
            "https://youtube.com.example.org/@team", "ftp://www.youtube.com/@team", "not a link",
            "https://www.youtube.com/@a", "https://www.youtube.com/@has%20space"})
    void aLinkThatIsNotOneOfAChannelNamesNone(String url) {
        assertThat(ChannelAddress.of(url)).isEmpty();
    }

    @Test
    void aHandleInAnyScriptIsKept() {
        assertThat(ChannelAddress.of("https://www.youtube.com/@LiênQuânTV")).contains(
                new ChannelAddress(Kind.HANDLE, "LiênQuânTV"));
    }

    @Test
    void handlesDifferingOnlyInCaseShareOneKey() {
        assertThat(ChannelAddress.of("https://www.youtube.com/@TeamFlash").orElseThrow().key())
                .isEqualTo(ChannelAddress.of("https://youtube.com/@teamflash").orElseThrow().key());
    }
}
