package com.wikiaov.user.internal.account.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.SecureRandom;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PasswordCodeTest {

    @Test
    void generatesSixDigitCodesAndMatchesOnlyTheSameChallenge() {
        var random = new SecureRandom();
        for (int index = 0; index < 200; index++) {
            assertThat(PasswordCode.generate(random)).matches("[0-9]{6}");
        }

        UUID challenge = UUID.randomUUID();
        byte[] stored = PasswordCode.hash(challenge, "012345");
        assertThat(stored).hasSize(32);
        assertThat(PasswordCode.matches(challenge, "012345", stored)).isTrue();
        assertThat(PasswordCode.matches(challenge, "012346", stored)).isFalse();
        assertThat(PasswordCode.matches(UUID.randomUUID(), "012345", stored)).isFalse();
        assertThat(PasswordCode.matches(challenge, "12345", stored)).isFalse();
        assertThat(PasswordCode.matches(challenge, null, stored)).isFalse();
    }

    @Test
    void masksEmailAddressesForDisplay() {
        assertThat(EmailHint.mask("reader@example.com")).isEqualTo("r•••r@example.com");
        assertThat(EmailHint.mask("ab@example.com")).isEqualTo("a•••@example.com");
        assertThat(EmailHint.mask("a@example.com")).isEqualTo("a•••@example.com");
        assertThat(EmailHint.mask("not-an-email")).isEqualTo("•••");
    }
}
