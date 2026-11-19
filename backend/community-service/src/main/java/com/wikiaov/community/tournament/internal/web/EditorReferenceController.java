package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Entry;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Kind;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EditorReferenceController implements EditorReferenceApi {
    private final EditorReferences references;

    public EditorReferenceController(EditorReferences references) {
        this.references = references;
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/reference-catalog", version = "1")
    public PageSlice<Entry> references(@RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) Kind kind, @RequestParam(required = false) List<UUID> ids,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "kind", "page", "size"), Set.of("ids"));
        return references.search(q, kind, ids, Parameters.pageable(page, size, "name"));
    }
}
