package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.season.application.RankedSeasons;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = ApiPaths.ADMIN + "/seasons", version = "1")
public class RankedSeasonController implements RankedSeasonApi {
    private final RankedSeasons seasons;

    public RankedSeasonController(RankedSeasons seasons) {
        this.seasons = seasons;
    }

    @GetMapping
    public List<RankedSeasons.View> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return seasons.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RankedSeasons.View create(@RequestBody RankedSeasons.Input input) {
        return seasons.create(input);
    }

    @PostMapping("/{seasonId}/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public java.util.Map<String, UUID> schedule(@PathVariable UUID seasonId,
            @RequestBody RankedSeasons.ScheduleInput input) {
        return java.util.Map.of("id", seasons.schedule(seasonId, input));
    }
}
