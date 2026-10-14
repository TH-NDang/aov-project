package com.wikiaov.user.internal.application;

import com.wikiaov.user.internal.domain.ProfileInput;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Validated fallback preferences for profiles that have not been saved yet. */
@ConfigurationProperties("wiki.user.profile-defaults")
public record ProfileDefaults(
        String locale,
        String timeZone
) {
    public ProfileDefaults {
        ProfileInput validated = new ProfileInput("Defaults", "", locale, timeZone, null, 0);
        locale = validated.locale();
        timeZone = validated.timeZone();
    }
}
