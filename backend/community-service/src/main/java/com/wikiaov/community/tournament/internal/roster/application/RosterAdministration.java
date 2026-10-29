package com.wikiaov.community.tournament.internal.roster.application;

import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.application.TournamentViews;
import com.wikiaov.community.tournament.internal.application.TournamentViews.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentViews.View;
import com.wikiaov.community.tournament.internal.archive.application.RecordLifecycleViews.*;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.archive.domain.RecordState;
import com.wikiaov.community.tournament.internal.archive.domain.RegistryKind;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.persistence.PlayerRepository;
import com.wikiaov.community.tournament.internal.persistence.TeamRepository;
import com.wikiaov.community.tournament.internal.persistence.TournamentRepository;
import com.wikiaov.community.tournament.internal.roster.domain.RosterRules;
import com.wikiaov.community.tournament.internal.roster.persistence.RosterRecord;
import com.wikiaov.community.tournament.internal.roster.persistence.RosterRepository;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class RosterAdministration {
    private final RegistryArchivePolicy archives;
    private final RosterRepository memberships;
    private final TournamentRepository tournaments;
    private final TeamRepository teams;
    private final PlayerRepository players;

    public RosterAdministration(RosterRepository memberships, TournamentRepository tournaments, TeamRepository teams,
            PlayerRepository players, RegistryArchivePolicy archives) {
        this.archives = archives;
        this.memberships = memberships;
        this.tournaments = tournaments;
        this.teams = teams;
        this.players = players;
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<View<RosterMembership>> list(UUID tournamentId, UUID teamId, UUID playerId, RecordState state,
            Pageable page) {
        var ordered = org.springframework.data.domain.PageRequest.of(page.getPageNumber(), page.getPageSize(),
                Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.asc("id")));
        return PageSlice.from(memberships.search(tournamentId, teamId, playerId, state.name(), ordered)
                .map(row -> TournamentViews.view(row, row.getContent())));
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View<RosterMembership> get(UUID id) {
        var row = memberships.findById(id).orElseThrow(TournamentErrors::missing);
        return TournamentViews.view(row, row.getContent());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    public View<RosterMembership> create(RosterMembership content) {
        archives.lockWrites();
        validate(content);

        var row = memberships.saveAndFlush(new RosterRecord(UUID.randomUUID(), content, actor()));
        return TournamentViews.view(row, row.getContent());
    }

    @PreAuthorize("hasAuthority('tournament:write')")
    public View<RosterMembership> update(UUID id, Long version, RosterMembership content) {
        archives.lockWrites();
        validate(content);

        var row = memberships.findById(id).orElseThrow(TournamentErrors::missing);
        RegistryArchivePolicy.requireActive(row);
        TournamentErrors.version(row.getVersion(), version);

        row.setContent(content, actor());
        memberships.flush();
        return TournamentViews.view(row, row.getContent());
    }

    private void validate(RosterMembership content) {
        var errors = RosterRules.violations(content);
        if (!errors.isEmpty())
            throw TournamentErrors.invalid(String.join(" ", errors));

        if (!tournaments.existsById(content.tournamentId()))
            throw TournamentErrors.invalid("Choose an existing tournament.");
        if (!teams.existsById(content.teamId()))
            throw TournamentErrors.invalid("Choose an existing team.");
        if (!players.existsById(content.playerId()))
            throw TournamentErrors.invalid("Choose an existing player.");

        archives.validateParents(content);
    }

    private static String actor() {
        var auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        return auth.getToken().getIssuer() + "|" + auth.getToken().getSubject();
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public Impact deletionImpact(UUID id) {
        var row = memberships.findById(id).orElseThrow(TournamentErrors::missing);
        return archives.impact(RegistryKind.ROSTER_MEMBERSHIP, row);
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('tournament:write')")
    public State lifecycle(UUID id, Long version, Action action, String actor) {
        archives.lockWrites();
        var row = memberships.findById(id).orElseThrow(TournamentErrors::missing);
        archives.mutate(RegistryKind.ROSTER_MEMBERSHIP, row, row.getContent(), version, action, actor);
        memberships.flush();
        return RegistryArchivePolicy.state(row);
    }
}
