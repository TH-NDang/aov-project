package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaOwnerView;
import com.wikiaov.media.internal.owner.application.MediaOwners;
import com.wikiaov.media.internal.web.request.MergeOwnerRequest;
import com.wikiaov.media.internal.web.request.UpdateOwnerRequest;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/media/owners")
class MediaOwnerAdminController implements MediaOwnerAdminApi {
    private final MediaOwners owners;

    MediaOwnerAdminController(MediaOwners owners) {
        this.owners = owners;
    }

    @Override
    @GetMapping(version = "1")
    public PageSlice<MediaOwnerView> list(HttpServletRequest http, @RequestParam(required = false) @Nullable String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(http, Set.of("q", "page", "size"));
        return owners.list(q, page, size);
    }

    @Override
    @PutMapping(path = "/{id}", version = "1")
    public MediaOwnerView update(@PathVariable UUID id, @RequestBody UpdateOwnerRequest request) {
        return owners.update(id, request.name(), request.contactUrl(), request.expectedVersion());
    }

    @Override
    @PostMapping(path = "/{id}/merge", version = "1")
    public MediaOwnerView merge(@PathVariable UUID id, @RequestBody MergeOwnerRequest request) {
        return owners.merge(id, request.targetId(), request.expectedVersion());
    }
}
