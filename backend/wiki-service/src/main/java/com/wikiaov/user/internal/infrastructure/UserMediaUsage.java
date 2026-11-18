package com.wikiaov.user.internal.infrastructure;

import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageProvider;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.user.internal.profile.persistence.ProfileRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class UserMediaUsage implements MediaUsageProvider {
    private final ProfileRepository profiles;

    UserMediaUsage(ProfileRepository profiles) {
        this.profiles = profiles;
    }

    @Override
    public List<MediaUsage> findUsages(UUID assetId) {
        return profiles.avatarOwners(assetId).stream().map(UserMediaUsage::usage).toList();
    }

    @Override
    public Map<UUID, List<MediaUsage>> findAllUsages() {
        Map<UUID, List<MediaUsage>> usages = new HashMap<>();
        for (var avatar : profiles.avatars()) {
            usages.computeIfAbsent(avatar.getAssetId(), ignored -> new ArrayList<>()).add(usage(avatar.getOwnerId()));
        }

        return usages;
    }

    private static MediaUsage usage(UUID owner) {
        return new MediaUsage("USER", "USER_PROFILE", owner, null, "AVATAR", MediaUsageScope.CURRENT);
    }
}
