package com.wikiaov.user.internal.web.request;

import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.application.UserErrorCode;
import com.wikiaov.user.internal.domain.ProfileInput;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record ProfileRequest(
        @NotBlank @Size(max = 80) String displayName,
        @NotNull @Size(max = 1000) String biography,
        @NotBlank @Size(max = 35) String locale,
        @NotBlank @Size(max = 64) String timeZone,
        @Nullable String dateFormat,
        @Nullable UUID avatarAssetId,
        @NotNull @Min(0) Long expectedVersion,
        @Nullable @Size(max = 3) String currency,
        @Nullable Boolean autoTranslate
) {
    public ProfileInput toInput() {
        try {
            return new ProfileInput(displayName, biography, locale, timeZone, dateFormat, avatarAssetId,
                    expectedVersion, currency, autoTranslate);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(UserErrorCode.USER_PROFILE_INVALID,
                    "Invalid profile language, time zone, currency or content.");
        }
    }
}
