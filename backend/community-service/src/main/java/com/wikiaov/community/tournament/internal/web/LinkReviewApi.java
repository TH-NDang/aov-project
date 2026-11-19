package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.review.domain.Mention;
import com.wikiaov.community.tournament.internal.review.domain.Mention.Count;
import com.wikiaov.community.tournament.internal.review.domain.MentionKind;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;

@Tag(name = "link review")
public interface LinkReviewApi {
    @Operation(operationId = "linkReviewApi_list", summary = "List text that names an MVP, a caster or an award recipient without a link")
    PageSlice<Mention> list(MentionKind kind, @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "linkReviewApi_facets", summary = "Count the text still to link, by kind")
    List<Count> facets();
}
