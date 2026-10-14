package com.wikiaov.user.internal.application.service;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.AvatarUploads;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.user.internal.application.ProfileDefaults;
import com.wikiaov.user.internal.application.UserErrorCode;
import com.wikiaov.user.internal.application.mapper.UserProfileMapper;
import com.wikiaov.user.internal.application.response.UserProfile;
import com.wikiaov.user.internal.domain.ProfileInput;
import com.wikiaov.user.internal.persistence.ProfileRepository;
import com.wikiaov.user.internal.persistence.entity.Profile;
import java.time.Clock;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserProfiles {
    private final ProfileRepository profiles;
    private final Clock clock;
    private final CurrentActor currentActor;
    private final AuditLog audit;
    private final AvatarUploads avatars;
    private final UserProfileMapper mapper;
    private final ProfileDefaults defaults;

    public UserProfiles(ProfileRepository profiles, CurrentActor currentActor, AuditLog audit, AvatarUploads avatars,
            Clock clock, UserProfileMapper mapper, ProfileDefaults defaults) {
        this.profiles = profiles;
        this.clock = clock;
        this.currentActor = currentActor;
        this.audit = audit;
        this.avatars = avatars;
        this.mapper = mapper;
        this.defaults = defaults;
    }

    @Transactional(readOnly = true)
    public UserProfile self() {
        Actor actor = human();
        return profiles.findByIssuerAndSubject(actor.issuer(), actor.subject()).map(this::view).orElseGet(
                () -> new UserProfile(null, actor.displayName() == null ? "" : actor.displayName(), "",
                        defaults.locale(),
                        defaults.timeZone(), null, null, 0, null, null));
    }

    @Transactional
    public UserProfile saveSelf(ProfileInput input) {
        Actor actor = human();
        var existing = profiles.findByIssuerAndSubject(actor.issuer(), actor.subject());
        validateAvatar(input, existing.map(Profile::getAvatarAssetId).orElse(null));
        Profile row;
        if (existing.isPresent()) {
            row = update(existing.get(), input);
        } else {
            if (input.expectedVersion() != 0)
                throw conflict();
            try {
                row = profiles.saveAndFlush(Profile.create(actor.issuer(), actor.subject(), input, clock.instant()));
            } catch (DataIntegrityViolationException exception) {
                if (exception.getMostSpecificCause() instanceof java.sql.SQLException sql
                        && "23505".equals(sql.getSQLState()))
                    throw conflict();
                throw exception;
            }
        }
        record(actor, row, input.expectedVersion());
        return view(row);
    }

    @PreAuthorize("hasAuthority('user:read')")
    @Transactional(readOnly = true)
    public PageSlice<UserProfile> list(String search, int page, int size) {
        var result = profiles.search(search, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("id"))));
        return new PageSlice<>(result.getContent().stream().map(this::view).toList(), page, size,
                result.getTotalElements());
    }

    @PreAuthorize("hasAuthority('user:read')")
    @Transactional(readOnly = true)
    public UserProfile get(UUID id) {
        return view(require(id));
    }

    @PreAuthorize("hasAuthority('user:write')")
    @Transactional
    public UserProfile save(UUID id, ProfileInput input) {
        Actor actor = human();
        var existing = require(id);
        validateAvatar(input, existing.getAvatarAssetId());
        var row = update(existing, input);
        record(actor, row, input.expectedVersion());
        return view(row);
    }

    private Profile update(Profile profile, ProfileInput input) {
        if (profile.getVersion() != input.expectedVersion())
            throw conflict();
        profile.update(input, clock.instant());
        try {
            return profiles.saveAndFlush(profile);
        } catch (ObjectOptimisticLockingFailureException exception) {
            throw conflict();
        }
    }

    private Profile require(UUID id) {
        return profiles.findById(id).orElseThrow(
                () -> new ApiException(UserErrorCode.USER_PROFILE_NOT_FOUND, "User profile does not exist."));
    }

    private Actor human() {
        Actor actor = currentActor.require();
        if (actor.type() != ActorType.HUMAN)
            throw new ApiException(PlatformErrorCode.FORBIDDEN, "A human account is required.");
        return actor;
    }

    private void validateAvatar(ProfileInput input, @Nullable UUID previous) {
        if (input.avatarAssetId() != null && !Objects.equals(previous, input.avatarAssetId())
                && !avatars.canBind(input.avatarAssetId())) {
            throw new ApiException(UserErrorCode.USER_AVATAR_INVALID,
                    "Avatar must be a completed upload owned by the caller.");
        }
    }

    private UserProfile view(Profile row) {
        String avatarUrl = row.getAvatarAssetId() == null
                ? null
                : avatars.previewUrl(row.getAvatarAssetId()).orElse(null);
        return mapper.toResponse(row, avatarUrl);
    }

    private void record(Actor actor, Profile row, long before) {
        audit.record(
                new AuditEntry(actor, before == 0 ? "USER_PROFILE_CREATED" : "USER_PROFILE_UPDATED", "USER_PROFILE",
                        row.getId(), null, before, row.getVersion(), null, Map.of()));
    }

    private static ApiException conflict() {
        return new ApiException(UserErrorCode.USER_PROFILE_CONFLICT, "Profile changed; reload before saving again.");
    }
}
