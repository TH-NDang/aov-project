package com.wikiaov.patch.internal.watch.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class PatchWatchRulesTest {
    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Instant NOW = Instant.parse("2026-11-26T03:30:00Z");

    @Test
    void aDailyScheduleReadsAtTheVietnameseTimeLaterTodayOrTomorrow() {
        var morning = new PatchNoteSchedule(PatchNoteScheduleMode.DAILY, LocalTime.of(8, 0), 6);
        var evening = new PatchNoteSchedule(PatchNoteScheduleMode.DAILY, LocalTime.of(20, 15), 6);

        assertThat(morning.next(NOW, VIETNAM)).isEqualTo(Instant.parse("2026-11-27T01:00:00Z"));
        assertThat(evening.next(NOW, VIETNAM)).isEqualTo(Instant.parse("2026-11-26T13:15:00Z"));
    }

    @Test
    void anHourlyScheduleReadsAfterItsGap() {
        var schedule = new PatchNoteSchedule(PatchNoteScheduleMode.EVERY_HOURS, LocalTime.of(8, 0), 3);

        assertThat(schedule.next(NOW, VIETNAM)).isEqualTo(NOW.plus(Duration.ofHours(3)));
    }

    @Test
    void retriesWaitLongerAfterEachFailureButNeverPastThePlannedRead() {
        Instant planned = NOW.plus(Duration.ofHours(20));

        assertThat(PatchWatchRules.retryAt(NOW, 1, planned)).isEqualTo(NOW.plus(Duration.ofMinutes(30)));
        assertThat(PatchWatchRules.retryAt(NOW, 3, planned)).isEqualTo(NOW.plus(Duration.ofHours(2)));
        assertThat(PatchWatchRules.retryAt(NOW, 9, planned)).isEqualTo(NOW.plus(Duration.ofHours(6)));
        assertThat(PatchWatchRules.retryAt(NOW, 9, NOW.plus(Duration.ofHours(1)))).isEqualTo(NOW.plus(
                Duration.ofHours(1)));
    }

    @Test
    void onlyRecentOrUndatedPostsEnterTheInbox() {
        assertThat(PatchWatchRules.firstState(NOW.minus(Duration.ofDays(3)), NOW)).isEqualTo(PatchNotePostState.NEW);
        assertThat(PatchWatchRules.firstState(null, NOW)).isEqualTo(PatchNotePostState.NEW);
        assertThat(PatchWatchRules.firstState(NOW.minus(Duration.ofDays(30)), NOW))
                .isEqualTo(PatchNotePostState.EARLIER);
    }

    @Test
    void anEditorCannotReadTheSameSourceTwiceWithinTwoMinutes() {
        assertThat(PatchWatchRules.manualCheckAllowed(null, NOW)).isTrue();
        assertThat(PatchWatchRules.manualCheckAllowed(NOW.minusSeconds(60), NOW)).isFalse();
        assertThat(PatchWatchRules.manualCheckAllowed(NOW.minusSeconds(120), NOW)).isTrue();
    }
}
