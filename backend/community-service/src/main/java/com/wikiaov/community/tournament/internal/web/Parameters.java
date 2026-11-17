package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import java.util.*;
import org.springframework.data.domain.*;

final class Parameters {
    private Parameters() {
    }

    static void search(String q) {
        if (q.length() > 120)
            throw TournamentErrors.invalid("Search is limited to 120 characters.");
    }

    static Pageable page(int page, int size, String sort) {
        if (page < 0 || page > 100000 || size < 1 || size > 500)
            throw TournamentErrors.invalid("Use a non-negative page and a size between 1 and 500.");
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, sort));
    }
}
