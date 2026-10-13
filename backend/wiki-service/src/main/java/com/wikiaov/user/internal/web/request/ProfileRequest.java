package com.wikiaov.user.internal.web.request;

import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.application.UserErrorCode;
import com.wikiaov.user.internal.domain.ProfileInput;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record ProfileRequest(
        @NotBlank @Size(max = 80) String displayName,
        @NotNull @Size(max = 1000) String biography,
        @NotBlank @Size(max = 35) String locale,
        @NotBlank @Size(max = 64) String timeZone,
        @Nullable UUID avatarAssetId,
        @NotNull @Min(0) Long expectedVersion
) {
    public ProfileInput toInput() {
        try {
            return new ProfileInput(displayName, biography, locale, timeZone, avatarAssetId, expectedVersion);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(UserErrorCode.USER_PROFILE_INVALID,
                    "Invalid profile language, time zone or content.");
        }
    }
}
