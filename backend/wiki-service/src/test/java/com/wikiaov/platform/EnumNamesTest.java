package com.wikiaov.platform;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EnumNamesTest {
    @Test
    void aConstantIsFoundByItsExactName() {
        assertThat(EnumNames.find(RevisionState.class, "PUBLISHED")).isEqualTo(RevisionState.PUBLISHED);
    }

    @Test
    void aNameInAnotherCaseOrMissingFindsNothing() {
        assertThat(EnumNames.find(RevisionState.class, "published")).isNull();
        assertThat(EnumNames.find(RevisionState.class, "ARCHIVED")).isNull();
        assertThat(EnumNames.find(RevisionState.class, null)).isNull();
    }
}
