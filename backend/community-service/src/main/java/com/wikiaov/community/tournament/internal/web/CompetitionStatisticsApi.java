package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.tournament.internal.statistics.application.StatisticsViews.GameStatistics;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.WebRequest;

@Tag(name = "competitions")
public interface CompetitionStatisticsApi {
    @Operation(operationId = "competitionStatisticsApi_statistics", summary = "Count the published games of a competition")
    ResponseEntity<GameStatistics> statistics(UUID id, @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);
}
