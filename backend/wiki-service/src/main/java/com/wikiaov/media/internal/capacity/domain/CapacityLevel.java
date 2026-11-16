package com.wikiaov.media.internal.capacity.domain;

/** How close a figure is to the free tier (ADR-030 section 9). */
public enum CapacityLevel {
    OK,
    /** At or above the warning ratio. */
    WARNING,
    /** At or above the critical ratio. */
    CRITICAL,
    /** Above the free tier: the excess is billed. */
    OVER;

    public static CapacityLevel of(double share, double warningRatio, double criticalRatio) {
        if (share > 1.0) {
            return OVER;
        }
        if (share >= criticalRatio) {
            return CRITICAL;
        }
        return share >= warningRatio ? WARNING : OK;
    }
}
