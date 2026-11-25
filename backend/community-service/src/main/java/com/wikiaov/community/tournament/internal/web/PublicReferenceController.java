package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.reference.application.PublicReferences;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Names;
import com.wikiaov.community.tournament.internal.reference.application.ReferenceViews.Preview;
import com.wikiaov.community.tournament.internal.reference.domain.ReferenceKind;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

@RestController
@RequestMapping(path = ApiPaths.ROOT + "/references")
public class PublicReferenceController implements PublicReferenceApi {
    /** Part of every tag: a release that answers in another shape must not leave browsers with the old one. */
    private static final String SHAPE = "references-1";

    private final PublicReferences references;

    public PublicReferenceController(PublicReferences references) {
        this.references = references;
    }

    @Override
    @GetMapping(version = "1")
    public ResponseEntity<Names> names(HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of());
        return cached(web, () -> references.names(ReferenceKind.CORE));
    }

    @Override
    @GetMapping(path = "/people", version = "1")
    public ResponseEntity<Names> people(HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of());
        return cached(web, () -> references.names(ReferenceKind.INDIVIDUALS));
    }

    @Override
    @GetMapping(path = "/{kind}/{id}", version = "1")
    public ResponseEntity<Preview> preview(@PathVariable ReferenceKind kind, @PathVariable UUID id,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of());
        return cached(web, () -> references.preview(kind, id));
    }

    private <T> ResponseEntity<T> cached(WebRequest web, Supplier<T> answer) {
        return TaggedAnswers.answer(web, SHAPE + "-" + references.revision(), answer);
    }
}
