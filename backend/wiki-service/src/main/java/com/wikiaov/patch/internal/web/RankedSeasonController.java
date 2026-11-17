package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.season.application.RankedSeasons;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CreatedId;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/seasons")
public class RankedSeasonController implements RankedSeasonApi {
    private final RankedSeasons seasons;

    public RankedSeasonController(RankedSeasons seasons) {
        this.seasons = seasons;
    }

    @GetMapping(version = "1")
    public List<RankedSeasons.View> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return seasons.list();
    }

    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public RankedSeasons.View create(@RequestBody RankedSeasons.Input input) {
        return seasons.create(input);
    }

    @PostMapping(path = "/{seasonId}/schedules", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedId schedule(@PathVariable UUID seasonId,
            @RequestBody RankedSeasons.ScheduleInput input) {
        return new CreatedId(seasons.schedule(seasonId, input));
    }
}
