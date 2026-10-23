package com.wikiaov.terminology.internal.application.response;

import com.wikiaov.platform.PageSlice;
import com.wikiaov.terminology.SkillReferenceProvider.Candidate;
import java.util.List;

/** Concrete cache value keeps nested reference types explicit during JSON decoding. */
public record SkillReferencePageView(
        List<Candidate> items,
        int page,
        int size,
        long totalElements
) {
    public SkillReferencePageView(PageSlice<Candidate> page) {
        this(page.items(), page.page(), page.size(), page.totalElements());
    }

    public PageSlice<Candidate> slice() {
        return new PageSlice<>(items, page, size, totalElements);
    }
}
