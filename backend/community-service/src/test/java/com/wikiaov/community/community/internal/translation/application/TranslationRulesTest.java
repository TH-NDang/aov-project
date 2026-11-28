package com.wikiaov.community.community.internal.translation.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.community.community.internal.translation.application.port.PostTranslator;
import com.wikiaov.community.community.internal.translation.domain.TranslatedPost;
import com.wikiaov.community.community.internal.translation.domain.TranslatedPost.ImageText;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class TranslationRulesTest {
    private static TranslationSettings settings(String key) {
        return new TranslationSettings(key, "claude-haiku-5-5", "medium", 8000, Duration.ofSeconds(60),
                List.of("vi-VN", "en-US"), List.of("vi-VN", "en-US", "th-TH"), "VN", Duration.ofMinutes(15),
                List.of("img.athahub.com"), 4, 5_000_000, 30, new BigDecimal("5"), new BigDecimal("0.10"),
                new BigDecimal("0.50"));
    }

    @Test
    void costsAreCountedInMillionthsOfADollar() {
        var settings = settings("key");

        // 10,000 input and 2,000 output tokens of Claude Haiku 5.5: 0.001 + 0.001 USD.
        assertThat(settings.costMicros(10_000, 2_000)).isEqualTo(2_000);
        assertThat(settings.monthlyBudgetMicros()).isEqualTo(5_000_000);
    }

    @Test
    void theKeyIsNeverPrinted() {
        var settings = settings("sk-ant-secret");

        assertThat(settings.enabled()).isTrue();
        assertThat(settings.toString()).doesNotContain("sk-ant-secret").contains("enabled=true");
        assertThat(settings(" ").enabled()).isFalse();
    }

    @Test
    void targetsMustBeReadByTheGlossaryToo() {
        assertThatThrownBy(() -> new TranslationSettings(null, "claude-haiku-5-5", "medium", 8000,
                Duration.ofSeconds(60), List.of("vi-VN", "en-US"), List.of("vi-VN"), "VN", Duration.ofMinutes(15),
                List.of(), 4, 5_000_000, 30, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void imageTextsFollowThePostEvenWhenAnImageCouldNotBeRead() {
        var image = new PostTranslator.Image(new byte[] {1}, "image/png");
        var answer = new TranslatedPost("vi-VN", null, "Look", List.of(new ImageText(0, true, "vi-VN", "Shop"),
                new ImageText(1, false, null, "ignored")));

        var placed = PostTranslations.inPostOrder(answer,
                List.of(Optional.of(image), Optional.empty(), Optional.of(image)));

        assertThat(placed.images()).extracting(ImageText::index).containsExactly(0, 1, 2);
        assertThat(placed.images()).extracting(ImageText::text).containsExactly("Shop", null, null);
        assertThat(placed.images()).extracting(ImageText::hasText).containsExactly(true, false, false);
    }

    @Test
    void eachRequesterHasAnHourlyLimit() {
        var clock = Clock.fixed(Instant.parse("2026-11-28T08:00:00Z"), ZoneOffset.UTC);
        var limiter = new TranslationLimiter(2, clock);

        assertThat(limiter.tryStart("address:1")).isTrue();
        assertThat(limiter.tryStart("address:1")).isTrue();
        assertThat(limiter.tryStart("address:1")).isFalse();
        assertThat(limiter.tryStart("address:2")).isTrue();
    }

    @Test
    void theHourSlides() {
        var later = new MutableClock(Instant.parse("2026-11-28T08:00:00Z"));
        var limiter = new TranslationLimiter(1, later);
        assertThat(limiter.tryStart("account:a")).isTrue();
        assertThat(limiter.tryStart("account:a")).isFalse();

        later.now = later.now.plus(Duration.ofMinutes(61));

        assertThat(limiter.tryStart("account:a")).isTrue();
    }

    private static final class MutableClock extends Clock {
        private Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
