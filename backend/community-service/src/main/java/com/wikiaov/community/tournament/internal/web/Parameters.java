package com.wikiaov.community.tournament.internal.web;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

final class Parameters {
    private Parameters() {
    }

    /** Longest search text of a registry list. */
    static final int MAX_SEARCH = 120;

    /** The bounds are declared on the {@code *Api} parameters; this only builds the request. */
    static Pageable pageable(int page, int size, String sort) {
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, sort));
    }
}
