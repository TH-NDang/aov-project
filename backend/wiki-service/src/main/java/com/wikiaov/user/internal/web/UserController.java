package com.wikiaov.user.internal.web;

import com.wikiaov.media.AvatarUploads;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.user.internal.application.response.UserProfile;
import com.wikiaov.user.internal.application.service.UserProfiles;
import com.wikiaov.user.internal.web.request.ProfileRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.*;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class UserController implements UserApi {
    private final UserProfiles profiles;
    private final AvatarUploads avatars;
    public UserController(UserProfiles profiles, AvatarUploads avatars) {
        this.profiles = profiles;
        this.avatars = avatars;
    }

    @GetMapping(path = "/users/me", version = "1")
    public UserProfile self(HttpServletRequest http) {
        QueryParameters.requireOnly(http, Set.of());
        return profiles.self();
    }

    @PutMapping(path = "/users/me", version = "1")
    public UserProfile saveSelf(HttpServletRequest http, @RequestBody ProfileRequest body) {
        QueryParameters.requireOnly(http, Set.of());
        return profiles.saveSelf(body.toInput());
    }

    @GetMapping(path = "/admin/users", version = "1")
    public PageSlice<UserProfile> list(HttpServletRequest http, @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(http, Set.of("search", "page", "size"));
        return profiles.list(search.strip(), page, size);
    }

    @GetMapping(path = "/admin/users/{id}", version = "1")
    public UserProfile get(HttpServletRequest http, @PathVariable UUID id) {
        QueryParameters.requireOnly(http, Set.of());
        return profiles.get(id);
    }

    @PutMapping(path = "/admin/users/{id}", version = "1")
    public UserProfile save(HttpServletRequest http, @PathVariable UUID id, @RequestBody ProfileRequest body) {
        QueryParameters.requireOnly(http, Set.of());
        return profiles.save(id, body.toInput());
    }

    public record AvatarRequest(
            @NotBlank @Size(max = 255) String fileName,
            @NotBlank String contentType,
            @Min(1) @Max(26214400) long sizeBytes
    ) {
    }

    @PostMapping(path = "/users/me/avatar-uploads", version = "1")
    public AvatarUploads.Ticket upload(HttpServletRequest http, @RequestBody AvatarRequest body) {
        QueryParameters.requireOnly(http, Set.of());
        return avatars.begin(body.fileName(), body.contentType(), body.sizeBytes());
    }

    @PostMapping(path = "/users/me/avatar-uploads/{id}/complete", version = "1")
    public AvatarUploads.Result complete(HttpServletRequest http, @PathVariable UUID id) {
        QueryParameters.requireOnly(http, Set.of());
        return avatars.complete(id);
    }
}
