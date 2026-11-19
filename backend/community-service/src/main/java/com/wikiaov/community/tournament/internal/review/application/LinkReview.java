package com.wikiaov.community.tournament.internal.review.application;

import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.review.domain.Mention;
import com.wikiaov.community.tournament.internal.review.domain.Mention.Count;
import com.wikiaov.community.tournament.internal.review.domain.MentionKind;
import com.wikiaov.community.tournament.internal.review.persistence.UnlinkedMentions;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** What editors still link by hand once the backfill has linked every certain match (ADR-032). */
@Service
public class LinkReview {
    private final UnlinkedMentions mentions;

    public LinkReview(UnlinkedMentions mentions) {
        this.mentions = mentions;
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Mention> list(MentionKind kind, int page, int size) {
        return new PageSlice<>(mentions.page(kind, page, size), page, size, mentions.total(kind));
    }

    /** Every kind with its count, those with nothing left included. */
    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<Count> facets() {
        Map<MentionKind, Long> counted = mentions.counts().stream()
                .collect(Collectors.toMap(Count::kind, Count::count));
        return Arrays.stream(MentionKind.values()).map(kind -> new Count(kind, counted.getOrDefault(kind, 0L)))
                .toList();
    }
}
