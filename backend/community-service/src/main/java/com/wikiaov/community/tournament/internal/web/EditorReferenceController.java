package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Entry;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Kind;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EditorReferenceController implements EditorReferenceApi {
    private final EditorReferences references;

    public EditorReferenceController(EditorReferences references) {
        this.references = references;
    }

    @Override
    public PageSlice<Entry> references(String q, Kind kind, List<UUID> ids, int page, int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("q", "kind", "page", "size"), Set.of("ids"));
        Parameters.search(q);
        return references.search(q, kind, ids, Parameters.page(page, size, "name"));
    }
}
