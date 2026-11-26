package com.wikiaov.community.community.internal.channels.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.community.community.internal.channels.application.ChannelViews.Broadcast;
import com.wikiaov.community.community.internal.channels.application.port.YouTubeSource;
import com.wikiaov.community.community.internal.channels.domain.ChannelAddress;
import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import com.wikiaov.community.community.internal.pages.application.PageAccess;
import com.wikiaov.community.community.internal.pages.persistence.PageRecord;
import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.PlatformErrorCode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class PageChannelsTest {
    static final UUID PAGE = UUID.randomUUID();
    static final String CHANNEL = "UCgYkGvtBuY4onYm2Eh61zwQ";
    static final String BY_ID = "https://www.youtube.com/channel/" + CHANNEL;
    static final String BY_HANDLE = "https://www.youtube.com/@teamflash";
    static final Instant NOW = Instant.parse("2026-11-26T10:00:00Z");
    final PageAccess access = mock(PageAccess.class);
    final FakeYouTube youtube = new FakeYouTube();

    PageChannels channels(boolean dataApi, int units) {
        youtube.dataApi = dataApi;
        var settings = new YouTubeSettings(dataApi ? "key" : null, "https://api", "https://feed", units,
                Duration.ofHours(24), Duration.ofMinutes(30));
        return new PageChannels(access, youtube, new YouTubeBudget(units, Clock.systemUTC()), settings);
    }

    @Test
    void aChannelThePageDoesNotLinkIsNotFound() {
        page(BY_ID);

        var failure = catchThrowableOfType(ApiException.class,
                () -> channels(true, 100).channel(PAGE, "https://www.youtube.com/@someone-else"));

        assertThat(failure.getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_NOT_FOUND);
        assertThat(youtube.calls).isEmpty();
    }

    @Test
    void aLinkToAnotherSiteIsNotAChannel() {
        page("https://www.facebook.com/teamflash");

        var failure = catchThrowableOfType(ApiException.class,
                () -> channels(true, 100).channel(PAGE, "https://www.facebook.com/teamflash"));

        assertThat(failure.getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_NOT_FOUND);
    }

    @Test
    void theLinksARepresentativeChoseAreTheOnesShown() {
        var row = page(BY_ID);
        row.setPresentation(new PageContent.Presentation(null, null, null,
                List.of(new PageContent.Link("YouTube", BY_HANDLE, true))));
        youtube.facts = facts();

        assertThat(channels(true, 100).channel(PAGE, BY_HANDLE).id()).isEqualTo(CHANNEL);
        assertThat(catchThrowableOfType(ApiException.class, () -> channels(true, 100).channel(PAGE, BY_ID))
                .getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_NOT_FOUND);
    }

    @Test
    void withoutTheDataApiAChannelLinkedByIdIsShownFromItsFeed() {
        page(BY_ID);

        var channel = channels(false, 0).channel(PAGE, BY_ID);

        assertThat(channel.title()).isEqualTo("Feed title");
        assertThat(channel.avatarUrl()).isNull();
        assertThat(channel.videos()).extracting(ChannelViews.Video::id).containsExactly("AAAAAAAAAAA",
                "BBBBBBBBBBB");
        assertThat(channel.more()).isFalse();
        assertThat(channel.url()).isEqualTo(BY_ID);
        assertThat(youtube.calls).containsExactly("feed");
    }

    @Test
    void withoutTheDataApiAHandleCannotBeRead() {
        page(BY_HANDLE);

        var failure = catchThrowableOfType(ApiException.class, () -> channels(false, 0).channel(PAGE, BY_HANDLE));

        assertThat(failure.getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_UNAVAILABLE);
    }

    @Test
    void theDataApiNamesTheChannelAndCompletesTheFeed() {
        page(BY_HANDLE);
        youtube.facts = facts();
        youtube.details = List.of(
                new YouTubeSource.VideoFacts("AAAAAAAAAAA", "Better title", NOW, 754, 99L, null),
                new YouTubeSource.VideoFacts("BBBBBBBBBBB", "", NOW, null, null, Broadcast.LIVE));

        var channel = channels(true, 100).channel(PAGE, BY_HANDLE);

        assertThat(channel.title()).isEqualTo("Team Flash");
        assertThat(channel.handle()).isEqualTo("@teamflash");
        assertThat(channel.subscriberCount()).isEqualTo(52_000L);
        assertThat(channel.more()).isTrue();
        var first = channel.videos().getFirst();
        assertThat(first.title()).isEqualTo("Better title");
        assertThat(first.durationSeconds()).isEqualTo(754);
        assertThat(first.viewCount()).isEqualTo(99L);
        var second = channel.videos().get(1);
        assertThat(second.title()).isEqualTo("Second");
        assertThat(second.broadcast()).isEqualTo(Broadcast.LIVE);
        assertThat(second.shortForm()).isTrue();
        assertThat(youtube.calls).containsExactly("channel", "feed", "videos");
    }

    @Test
    void anUploadTheDataApiNoLongerListsIsLeftOut() {
        page(BY_ID);
        youtube.facts = facts();
        youtube.details = List.of(new YouTubeSource.VideoFacts("BBBBBBBBBBB", "Second", NOW, 30, 5L, null));

        var channel = channels(true, 100).channel(PAGE, BY_ID);

        assertThat(channel.videos()).extracting(ChannelViews.Video::id).containsExactly("BBBBBBBBBBB");
    }

    @Test
    void aSecondReaderIsAnsweredFromMemory() {
        page(BY_HANDLE);
        youtube.facts = facts();
        var channels = channels(true, 100);

        channels.channel(PAGE, BY_HANDLE);
        channels.channel(PAGE, BY_HANDLE);

        assertThat(youtube.calls).containsExactly("channel", "feed", "videos");
    }

    @Test
    void whenTheFeedFailsTheUploadsListStandsIn() {
        page(BY_ID);
        youtube.facts = facts();
        youtube.feedFails = true;
        youtube.uploads = new YouTubeSource.UploadPage(
                List.of(new YouTubeSource.Upload("CCCCCCCCCCC", "From the API", NOW, null, false)), "NEXT");

        var channel = channels(true, 100).channel(PAGE, BY_ID);

        assertThat(channel.videos()).extracting(ChannelViews.Video::title).containsExactly("From the API");
        assertThat(youtube.calls).containsExactly("channel", "feed", "uploads:null:15", "videos");
    }

    @Test
    void withTheDailyShareSpentAChannelLinkedByIdIsShownFromItsFeed() {
        page(BY_ID);
        youtube.facts = facts();

        var channel = channels(true, 0).channel(PAGE, BY_ID);

        assertThat(channel.title()).isEqualTo("Feed title");
        assertThat(channel.videos()).hasSize(2);
        assertThat(youtube.calls).containsExactly("feed");
    }

    @Test
    void aFailureIsNotRetriedAtOnce() {
        page(BY_ID);
        youtube.feedFails = true;
        var channels = channels(false, 0);

        var first = catchThrowableOfType(ApiException.class, () -> channels.channel(PAGE, BY_ID));
        var second = catchThrowableOfType(ApiException.class, () -> channels.channel(PAGE, BY_ID));

        assertThat(first.getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_UNAVAILABLE);
        assertThat(second.getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_UNAVAILABLE);
        assertThat(youtube.calls).containsExactly("feed");
    }

    @Test
    void aQuotaRefusalStopsTheDataApiForTheDay() {
        page(BY_ID);
        youtube.facts = facts();
        youtube.quotaRefused = true;
        var channels = channels(true, 100);

        channels.channel(PAGE, BY_ID);

        assertThat(catchThrowableOfType(ApiException.class, () -> channels.videos(PAGE, BY_ID, null))
                .getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_UNAVAILABLE);
        assertThat(youtube.calls).containsExactly("channel", "feed", "videos");
    }

    @Test
    void olderUploadsComeAPageAtATime() {
        page(BY_ID);
        youtube.facts = facts();
        youtube.uploads = new YouTubeSource.UploadPage(
                List.of(new YouTubeSource.Upload("CCCCCCCCCCC", "Older", NOW, null, false)), "NEXT");
        youtube.details = List.of(new YouTubeSource.VideoFacts("CCCCCCCCCCC", "Older", NOW, 60, 1L, null));

        var page = channels(true, 100).videos(PAGE, BY_ID, "TOKEN_1");

        assertThat(page.videos()).extracting(ChannelViews.Video::id).containsExactly("CCCCCCCCCCC");
        assertThat(page.nextPageToken()).isEqualTo("NEXT");
        assertThat(youtube.calls).containsExactly("channel", "uploads:TOKEN_1:24", "videos");
    }

    @Test
    void olderUploadsNeedTheDataApi() {
        page(BY_ID);

        assertThat(catchThrowableOfType(ApiException.class, () -> channels(false, 0).videos(PAGE, BY_ID, null))
                .getErrorCode()).isEqualTo(ChannelErrorCode.CHANNEL_UNAVAILABLE);
    }

    @Test
    void aPageTokenTheServiceCouldNotHaveGivenIsRefused() {
        page(BY_ID);

        assertThat(catchThrowableOfType(ApiException.class,
                () -> channels(true, 100).videos(PAGE, BY_ID, "a/../b")).getErrorCode())
                .isEqualTo(PlatformErrorCode.INVALID_QUERY_PARAMETER);
    }

    PageRecord page(String... links) {
        var row = new PageRecord();
        row.setId(PAGE);
        row.setKind(Kind.TEAM);
        var content = new PageContent("Team Flash", "FL", "VN", null, null, null,
                java.util.Arrays.stream(links).map(url -> new PageContent.Link("YouTube", url, true)).toList(),
                List.of(), List.of(), List.of(), List.of(), List.of(), null);
        row.setContent(content);
        row.setPublishedContent(content);
        when(access.published(PAGE)).thenReturn(row);
        return row;
    }

    static YouTubeSource.ChannelFacts facts() {
        return new YouTubeSource.ChannelFacts(CHANNEL, "Team Flash", "@teamflash", "Official", "https://a", "https://b",
                52_000L, 300L);
    }

    static final class FakeYouTube implements YouTubeSource {
        final List<String> calls = new ArrayList<>();
        boolean dataApi;
        boolean feedFails;
        boolean quotaRefused;
        @Nullable
        ChannelFacts facts;
        @Nullable
        List<VideoFacts> details;
        @Nullable
        UploadPage uploads;

        @Override
        public boolean dataApi() {
            return dataApi;
        }

        @Override
        public Optional<ChannelFacts> channel(ChannelAddress address) {
            calls.add("channel");
            return Optional.ofNullable(facts);
        }

        @Override
        public Optional<Feed> feed(String channelId) {
            calls.add("feed");
            if (feedFails) {
                throw new Unavailable("down", false, null);
            }
            return Optional.of(new Feed("Feed title", List.of(new Upload("AAAAAAAAAAA", "First", NOW, 10L, false),
                    new Upload("BBBBBBBBBBB", "Second", NOW.minusSeconds(60), null, true))));
        }

        @Override
        public Optional<UploadPage> uploads(String channelId, @Nullable String pageToken, int size) {
            calls.add("uploads:" + pageToken + ":" + size);
            return Optional.ofNullable(uploads);
        }

        @Override
        public List<VideoFacts> videos(Collection<String> ids) {
            calls.add("videos");
            if (quotaRefused) {
                throw new Unavailable("quota", true, null);
            }
            return details == null
                    ? ids.stream().map(id -> new VideoFacts(id, "", NOW, null, null, null)).toList()
                    : details;
        }
    }
}
