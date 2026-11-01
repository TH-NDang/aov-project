package com.wikiaov.media.internal.owner.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MediaOwnerNamesTest {
    @Test
    void spellingsThatDifferOnlyInCaseOrWhitespaceShareAKey() {
        String display = MediaOwnerNames.display("  Garena   /\tLiên Quân  Mobile ");

        assertThat(display).isEqualTo("Garena / Liên Quân Mobile");
        assertThat(MediaOwnerNames.key(display)).isEqualTo("garena / liên quân mobile");
        assertThat(MediaOwnerNames.key(MediaOwnerNames.display("GARENA / LIÊN QUÂN MOBILE")))
                .isEqualTo(MediaOwnerNames.key(display));
        assertThat(MediaOwnerNames.display(" \t ")).isNull();
        assertThat(MediaOwnerNames.display(null)).isNull();
    }
}
