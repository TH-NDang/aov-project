package com.wikiaov.community.community.internal.channels.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource;
import com.wikiaov.community.community.internal.pages.application.PageAccess;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

/** The channel beans wire up from the settings alone, without a database. */
class ChannelConfigurationTest {
    private final ApplicationContextRunner context = new ApplicationContextRunner()
            .withUserConfiguration(ChannelConfiguration.class, PageChannels.class)
            .withBean(PageAccess.class, () -> mock(PageAccess.class))
            .withBean(YouTubeSource.class, () -> mock(YouTubeSource.class))
            .withPropertyValues("community.youtube.api-url=https://www.googleapis.com/youtube/v3",
                    "community.youtube.feed-url=https://www.youtube.com/feeds/videos.xml",
                    "community.youtube.daily-units=8000", "community.youtube.channel-ttl=PT24H",
                    "community.youtube.videos-ttl=PT30M");

    @Test
    void theServiceAndItsBudgetAreCreated() {
        context.run(started -> {
            assertThat(started).hasNotFailed().hasSingleBean(PageChannels.class).hasSingleBean(YouTubeBudget.class);
            assertThat(started.getBean(YouTubeSettings.class).dataApi()).isFalse();
        });
    }

    @Test
    void settingsWithoutTheirUrlsStopTheStart() {
        context.withPropertyValues("community.youtube.api-url=").run(started -> assertThat(started).hasFailed());
    }
}
