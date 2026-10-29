package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.application.TournamentViews.PageSlice;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Entry;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Kind;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
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
        Parameters.only(request, "q", "kind", "ids", "page", "size");
        Parameters.search(q);
        return references.search(q, kind, ids, Parameters.page(page, size, "name"));
    }
}
