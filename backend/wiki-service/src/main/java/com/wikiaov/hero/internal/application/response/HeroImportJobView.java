package com.wikiaov.hero.internal.application.response;

import java.time.Instant;
import java.util.*;

public record HeroImportJobView(
        UUID id,
        String status,
        int completed,
        int total,
        Instant createdAt,
        Instant updatedAt,
        boolean notificationDismissed,
        List<Row> results
) {
    public record Row(
            String code,
            boolean succeeded,
            String errorCode,
            String detail
    ) {
    }
}
