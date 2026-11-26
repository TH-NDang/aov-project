package com.wikiaov.community.community.internal.channels.application;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * The Data API units spent today. Google's quota restarts at midnight Pacific time; once the configured share is spent,
 * or Google refuses for the quota, channels are shown from their feeds alone until then.
 */
class YouTubeBudget {
    private static final ZoneId QUOTA_DAY = ZoneId.of("America/Los_Angeles");
    private final int dailyUnits;
    private final Clock clock;
    private LocalDate day;
    private int spent;

    YouTubeBudget(int dailyUnits, Clock clock) {
        this.dailyUnits = dailyUnits;
        this.clock = clock;
        this.day = today();
    }

    /** Takes one unit when one is left today. */
    synchronized boolean spend() {
        roll();
        if (spent >= dailyUnits) {
            return false;
        }
        spent++;
        return true;
    }

    /** Google refused for the quota: nothing more is spent today. */
    synchronized void exhaust() {
        roll();
        spent = dailyUnits;
    }

    synchronized int spent() {
        roll();
        return spent;
    }

    private void roll() {
        var now = today();
        if (!now.equals(day)) {
            day = now;
            spent = 0;
        }
    }

    private LocalDate today() {
        return LocalDate.now(clock.withZone(QUOTA_DAY));
    }
}
