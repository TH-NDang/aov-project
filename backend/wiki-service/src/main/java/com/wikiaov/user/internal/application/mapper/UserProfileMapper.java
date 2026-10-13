package com.wikiaov.user.internal.application.mapper;

import com.wikiaov.platform.MappingConfiguration;
import com.wikiaov.user.internal.application.response.UserProfile;
import com.wikiaov.user.internal.persistence.entity.Profile;
import org.jspecify.annotations.Nullable;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** Maps profile data; the application service resolves the avatar URL. */
@Mapper(config = MappingConfiguration.class)
public interface UserProfileMapper {
    @Mapping(target = "avatarUrl", source = "avatarUrl")
    UserProfile toResponse(Profile profile, @Nullable String avatarUrl);
}
