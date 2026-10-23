package com.wikiaov.patch.internal.context.application;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import org.jspecify.annotations.Nullable;

/** Preserves the millisecond UTC wire format of the existing admin map responses. */
final class AdminTimestamp {
    private static final DateTimeFormatter FORMAT = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();

    private AdminTimestamp() {
    }

    static @Nullable String format(@Nullable Instant value) {
        return value == null ? null : FORMAT.format(value);
    }
}
