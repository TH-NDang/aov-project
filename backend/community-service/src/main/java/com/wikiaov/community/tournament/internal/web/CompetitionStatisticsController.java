package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.statistics.application.CompetitionStatistics;
import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameStatistics;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;

@RestController
@RequestMapping(path = ApiPaths.ROOT + "/competitions")
public class CompetitionStatisticsController implements CompetitionStatisticsApi {
    /** Part of every tag: a release that answers in another shape must not leave browsers with the old one. */
    private static final String SHAPE = "statistics-1";

    private final CompetitionStatistics statistics;

    public CompetitionStatisticsController(CompetitionStatistics statistics) {
        this.statistics = statistics;
    }

    @Override
    @GetMapping(path = "/{id}/statistics", version = "1")
    public ResponseEntity<GameStatistics> statistics(@PathVariable UUID id, HttpServletRequest request,
            WebRequest web) {
        QueryParameters.requireOnly(request, Set.of());
        var counted = statistics.of(id);

        return TaggedAnswers.answer(web, SHAPE + "-" + counted.revision(), counted::statistics);
    }
}
