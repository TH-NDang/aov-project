package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Entry;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Kind;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RequestMapping(version = "1")
public interface EditorReferenceApi {
    /** Returns minimal editor references without exposing unpublished registries through a public endpoint. */
    @GetMapping(ApiPaths.ADMIN + "/reference-catalog")
    PageSlice<Entry> references(@RequestParam(defaultValue = "") @Size(max = Parameters.MAX_SEARCH) String q,
            @RequestParam(required = false) Kind kind, @RequestParam(required = false) List<UUID> ids,
            @RequestParam(defaultValue = "0") @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page,
            @RequestParam(defaultValue = "30") @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            HttpServletRequest request);
}
