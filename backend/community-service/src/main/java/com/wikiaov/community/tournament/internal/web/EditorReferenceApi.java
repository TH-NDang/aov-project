package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.tournament.internal.application.TournamentViews.PageSlice;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Entry;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Kind;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RequestMapping(version = "1")
public interface EditorReferenceApi {
    /** Returns minimal editor references without exposing unpublished registries through a public endpoint. */
    @GetMapping(ApiPaths.ADMIN + "/reference-catalog")
    PageSlice<Entry> references(@RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Kind kind, @RequestParam(required = false) List<UUID> ids,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size,
            HttpServletRequest request);
}
