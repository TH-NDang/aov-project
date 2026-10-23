package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.response.PatchDataReviewView;
import com.wikiaov.patch.internal.review.application.PatchDataReviewService;
import com.wikiaov.platform.ApiPaths;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/patch-variants")
public class PatchDataReviewController implements PatchDataReviewApi {
    private final PatchDataReviewService reviews;

    public PatchDataReviewController(PatchDataReviewService reviews) {
        this.reviews = reviews;
    }

    @PutMapping(path = "/{id}/data-review", version = "1")
    public PatchDataReviewView update(@PathVariable UUID id, @RequestBody PatchDataReviewService.Update input) {
        return reviews.update(id, input);
    }
}
