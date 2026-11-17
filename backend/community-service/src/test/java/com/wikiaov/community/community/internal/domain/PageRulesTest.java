package com.wikiaov.community.community.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class PageRulesTest {
    private static final String IMAGE = "https://cdn.example/image.png";

    @Test
    void aPostWithoutAKindIsATextPost() {
        assertThat(PageRules.post(new PostContent(null, null, "Hello", null, null)).kind()).isEqualTo("TEXT");
    }

    @Test
    void aPostIsTrimmedAndKeepsNoBlankTitle() {
        var post = PageRules.post(new PostContent("TEXT", "  ", "  Hello  ", null, List.of(IMAGE)));

        assertThat(post).isEqualTo(new PostContent("TEXT", null, "Hello", null, List.of(IMAGE)));
    }

    @Test
    void anUnknownPostKindIsRefused() {
        assertThatThrownBy(() -> PageRules.post(new PostContent("POLL", null, "Vote", null, List.of())))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aNewsPostNeedsATitle() {
        assertThatThrownBy(() -> PageRules.post(new PostContent("NEWS", null, "Body", null, List.of())))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aVideoPostMayHaveNoText() {
        assertThatCode(() -> PageRules.post(new PostContent("VIDEO", null, null, "https://video.example/1", null)))
                .doesNotThrowAnyException();
    }

    @Test
    void aVideoPostNeedsAVideoLink() {
        assertThatThrownBy(() -> PageRules.post(new PostContent("VIDEO", null, "Text", null, null)))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aPostHoldsAtMostFourImages() {
        var five = List.of(IMAGE, IMAGE, IMAGE, IMAGE, IMAGE);

        assertThatThrownBy(() -> PageRules.post(new PostContent("TEXT", null, "Body", null, five)))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aLinkWithCredentialsIsRefused() {
        assertThatThrownBy(() -> PageRules.url("https://user:secret@example.com/page"))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aLinkMustBeAbsoluteHttp() {
        assertThatThrownBy(() -> PageRules.url("ftp://example.com/file")).isInstanceOf(PageRules.InvalidPage.class);
        assertThatThrownBy(() -> PageRules.url("/relative")).isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aBlankSearchMatchesEverything() {
        assertThat(PageRules.searchPattern("  ")).isNull();
    }

    @Test
    void aSearchEscapesTheWildcardsOfItsText() {
        assertThat(PageRules.searchPattern(" 50%_off ")).isEqualTo("%50\\%\\_off%");
    }

    @Test
    void aBlankKindFilterKeepsEveryKind() {
        assertThat(PageRules.postKindFilter("")).isNull();
    }

    @Test
    void aPageNeedsAName() {
        assertThatThrownBy(() -> PageRules.content(content(" ", List.of())))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aHistoryEntryCannotEndBeforeItStarts() {
        var history = new PageContent.History(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 4, 1), "Coach", null,
                null, null);

        assertThatThrownBy(() -> PageRules.content(content("Team", List.of(history))))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aPresentationHoldsAtMostTwentyLinks() {
        var links = Collections.nCopies(21, new PageContent.Link("Site", "https://example.com", null));

        assertThatThrownBy(() -> PageRules.presentation(new PageContent.Presentation(null, null, null, links)))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aBroadcastNeedsALinkAndATitle() {
        assertThatThrownBy(() -> PageRules.live("https://live.example/1", " "))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    private static PageContent content(String name, List<PageContent.History> history) {
        return new PageContent(name, null, null, null, null, null, List.of(), List.of(), history, List.of(), List.of(),
                List.of(), null);
    }
}
