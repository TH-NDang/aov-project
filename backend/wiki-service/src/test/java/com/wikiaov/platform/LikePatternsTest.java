package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LikePatternsTest {
    @Test
    void aSearchIsLowerCasedTrimmedAndMatchedLiterally() {
        assertThat(LikePatterns.contains("  100%_Đỏ\\ ")).isEqualTo("%100\\%\\_đỏ\\\\%");
    }

    @Test
    void aBlankSearchMatchesEverything() {
        assertThat(LikePatterns.contains(" ")).isEqualTo("%");
        assertThat(LikePatterns.contains(null)).isEqualTo("%");
    }
}
