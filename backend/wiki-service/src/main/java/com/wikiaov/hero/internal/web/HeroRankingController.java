package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroRankingCommands.ConfirmSnapshot;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ImportSnapshot;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ReviewValue;
import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.hero.internal.ranking.application.HeroRankings;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/ranking-snapshots")
public class HeroRankingController implements HeroRankingApi {
    private final HeroRankings rankings;

    public HeroRankingController(HeroRankings rankings) {
        this.rankings = rankings;
    }

    @Override
    @GetMapping(version = "1")
    public PageSlice<HeroRankingViews.Summary> list(@RequestParam(required = false) String region,
            @RequestParam(required = false) String mode, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "mode", "page", "size"));
        return rankings.list(region, mode, page, size);
    }

    @Override
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public HeroRankingViews.Detail importSnapshot(@RequestBody ImportSnapshot body) {
        return rankings.importSnapshot(body);
    }

    @Override
    @GetMapping(path = "/{snapshotId}", version = "1")
    public HeroRankingViews.Detail detail(@PathVariable UUID snapshotId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return rankings.detail(snapshotId);
    }

    @Override
    @PutMapping(path = "/{snapshotId}/heroes/{heroId}/values/{metric}", version = "1")
    public HeroRankingViews.Reviewed review(@PathVariable UUID snapshotId, @PathVariable UUID heroId,
            @PathVariable String metric, @RequestBody ReviewValue body) {
        return rankings.review(snapshotId, heroId, metric, body);
    }

    @Override
    @PostMapping(path = "/{snapshotId}/confirm", version = "1")
    public HeroRankingViews.Summary confirm(@PathVariable UUID snapshotId, @RequestBody ConfirmSnapshot body) {
        return rankings.confirm(snapshotId, body);
    }

    @Override
    @DeleteMapping(path = "/{snapshotId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID snapshotId, @RequestParam long expectedVersion) {
        rankings.delete(snapshotId, expectedVersion);
    }
}
