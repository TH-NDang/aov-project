package com.wikiaov.terminology.internal.application.response;

import com.wikiaov.terminology.AdminReferenceProvider.Candidate;
import java.util.List;
import java.util.UUID;

public record AdminReferenceCatalogView(
        UUID rulesetId,
        List<Candidate> items
) {
}
