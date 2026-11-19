package com.wikiaov.community.community.internal.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import com.wikiaov.community.community.internal.domain.PostContent;
import com.wikiaov.community.platform.ApiException;
import java.util.List;
import org.junit.jupiter.api.Test;

class PageChecksTest {
    @Test
    void aBrokenPageRuleIsAnsweredAsInvalidPageContent() {
        var error = catchThrowableOfType(ApiException.class,
                () -> PageChecks.post(new PostContent("POLL", null, "Vote", null, List.of())));

        assertThat(error.getErrorCode()).isEqualTo(PageErrorCode.PAGE_INVALID_CONTENT);
        assertThat(error.getMessage()).isEqualTo("Use a TEXT, NEWS or VIDEO post.");
    }

    @Test
    void aPostThatKeepsTheRulesComesBackCleaned() {
        var post = PageChecks.post(new PostContent(null, null, "  Hello  ", null, null));

        assertThat(post).isEqualTo(new PostContent("TEXT", null, "Hello", null, List.of()));
    }
}
