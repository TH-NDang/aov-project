package com.wikiaov.user.internal.infrastructure;

import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.user.internal.profile.persistence.ProfileRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class UserMediaUsage implements MediaUsageProvider {
    private final ProfileRepository profiles;

    UserMediaUsage(ProfileRepository profiles) {
        this.profiles = profiles;
    }

    public List<MediaUsage> findUsages(UUID assetId) {
        return profiles.avatarOwners(assetId).stream()
                .map(id -> new MediaUsage("USER", "USER_PROFILE", id, null, "AVATAR", MediaUsageScope.CURRENT))
                .toList();
    }
}
