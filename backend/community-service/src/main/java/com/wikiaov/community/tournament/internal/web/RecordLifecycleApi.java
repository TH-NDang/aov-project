package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.tournament.internal.application.TournamentViews.Version;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.Impact;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.State;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

@RequestMapping(path = ApiPaths.ADMIN
        + "/{kind:teams|players|tournaments|series|roster-memberships|games}/{id}", version = "1")
public interface RecordLifecycleApi {
    @GetMapping("/deletion-impact")
    Impact impact(@PathVariable String kind, @PathVariable UUID id, HttpServletRequest request);

    @PostMapping("/delete")
    State delete(@PathVariable String kind, @PathVariable UUID id, @RequestBody Version request);

    @PostMapping("/restore")
    State restore(@PathVariable String kind, @PathVariable UUID id, @RequestBody Version request);
}
