package com.wikiaov.terminology.internal.application.response;

import com.wikiaov.terminology.internal.domain.ReferenceSettings;

public record ReferenceSettingsView(
        long version,
        ReferenceSettings settings
) {
}
