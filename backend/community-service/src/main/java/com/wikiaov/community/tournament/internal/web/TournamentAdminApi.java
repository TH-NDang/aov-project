package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.tournament.internal.application.TournamentViews.*;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RequestMapping(version = "1")
public interface TournamentAdminApi {
    @GetMapping(ApiPaths.ADMIN + "/me")
    Map<String, Object> me();

    @GetMapping(ApiPaths.ADMIN + "/catalog")
    Catalog catalog(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(required = false) UUID seasonId,
            @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/teams")
    PageSlice<View<Team>> teams(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size, HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/teams/{id}")
    View<Team> getTeam(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/teams")
    View<Team> createTeam(@RequestBody Create<Team> request);

    @PutMapping(ApiPaths.ADMIN + "/teams/{id}")
    View<Team> updateTeam(@PathVariable UUID id, @RequestBody Update<Team> request);

    @GetMapping(ApiPaths.ADMIN + "/players")
    PageSlice<View<Player>> players(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/players/{id}")
    View<Player> getPlayer(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/players")
    View<Player> createPlayer(@RequestBody Create<Player> request);

    @PutMapping(ApiPaths.ADMIN + "/players/{id}")
    View<Player> updatePlayer(@PathVariable UUID id, @RequestBody Update<Player> request);

    @GetMapping(ApiPaths.ADMIN + "/tournaments")
    PageSlice<View<Tournament>> tournaments(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/tournaments/{id}")
    View<Tournament> getTournament(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/tournaments")
    View<Tournament> createTournament(@RequestBody Create<Tournament> request);

    @PutMapping(ApiPaths.ADMIN + "/tournaments/{id}")
    View<Tournament> updateTournament(@PathVariable UUID id, @RequestBody Update<Tournament> request);

    @GetMapping(ApiPaths.ADMIN + "/series")
    PageSlice<View<Series>> series(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/series/{id}")
    View<Series> getSeries(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/series")
    View<Series> createSeries(@RequestBody Create<Series> request);

    @PutMapping(ApiPaths.ADMIN + "/series/{id}")
    View<Series> updateSeries(@PathVariable UUID id, @RequestBody Update<Series> request);

    @GetMapping(ApiPaths.ADMIN + "/games")
    PageSlice<View<Game>> games(@RequestParam(required = false) UUID seriesId,
            @RequestParam(defaultValue = "ACTIVE") RecordState state, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request);

    @GetMapping(ApiPaths.ADMIN + "/games/{id}")
    View<Game> getGame(@PathVariable UUID id);

    @PostMapping(ApiPaths.ADMIN + "/games")
    View<Game> createGame(@RequestBody Create<Game> request);

    @PutMapping(ApiPaths.ADMIN + "/games/{id}")
    View<Game> updateGame(@PathVariable UUID id, @RequestBody Update<Game> request);

    @PostMapping(ApiPaths.ADMIN + "/games/{id}/publish")
    View<Game> publishGame(@PathVariable UUID id, @RequestBody Version request);

    @PostMapping(ApiPaths.ADMIN + "/games/{id}/withdraw")
    View<Game> withdrawGame(@PathVariable UUID id, @RequestBody Version request);
}
