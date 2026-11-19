package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.review.application.LinkReview;
import com.wikiaov.community.tournament.internal.review.domain.Mention;
import com.wikiaov.community.tournament.internal.review.domain.Mention.Count;
import com.wikiaov.community.tournament.internal.review.domain.MentionKind;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LinkReviewController implements LinkReviewApi {
    private final LinkReview review;
    private final HttpServletRequest request;

    public LinkReviewController(LinkReview review, HttpServletRequest request) {
        this.review = review;
        this.request = request;
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/link-review", version = "1")
    public PageSlice<Mention> list(@RequestParam MentionKind kind, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        QueryParameters.requireOnly(request, Set.of("kind", "page", "size"));
        return review.list(kind, page, size);
    }

    @Override
    @GetMapping(path = ApiPaths.ADMIN + "/link-review/facets", version = "1")
    public List<Count> facets() {
        QueryParameters.requireOnly(request, Set.of());
        return review.facets();
    }
}
