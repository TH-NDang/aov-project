package com.wikiaov.community.tournament.internal.planning.application;

import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.archive.application.RegistryArchivePolicy;
import com.wikiaov.community.tournament.internal.domain.SourceUrls;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionRules;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionSnapshot;
import com.wikiaov.community.tournament.internal.planning.domain.PlanRevisionAction;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRecord;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository;
import com.wikiaov.community.tournament.internal.planning.persistence.PlanRevision;
import com.wikiaov.community.tournament.internal.planning.persistence.PlanRevisionRepository;
import com.wikiaov.community.tournament.internal.registry.application.SeriesRegistry;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompetitionPlanning {
    public record View(
            UUID id,
            long version,
            Instant publishedAt,
            CompetitionSnapshot content
    ) {
    }

    /** What a list of published competitions is narrowed to; a null id leaves its filter out. */
    public record PublishedFilter(
            @Nullable UUID teamId,
            @Nullable UUID playerId,
            @Nullable UUID organizerPageId,
            @Nullable UUID circuitPageId
    ) {
    }

    public record Summary(
            UUID id,
            int entrants,
            int matches,
            Instant publishedAt,
            Tournament tournament
    ) {
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public PageSlice<Summary> summaries(int page, int size, UUID organizerPageId, UUID circuitPageId) {
        var rows = plans.summaries(organizerPageId == null ? "" : organizerPageId.toString(),
                circuitPageId == null ? "" : circuitPageId.toString(),
                PageRequest.of(page, size));
        var details = inputs.tournamentDetails(rows.stream().map(CompetitionPlanRecord::getId).toList());
        return PageSlice.from(rows.map(row -> new Summary(row.getId(), row.getContent().entrants().size(),
                row.getContent().matches().size(), row.getPublishedAt(), details.get(row.getId()))));
    }

    private final CompetitionPlanRepository plans;
    private final PlanRevisionRepository revisions;
    private final CompetitionInputs inputs;
    private final SeriesRegistry series;
    private final RegistryArchivePolicy archives;

    public CompetitionPlanning(CompetitionPlanRepository plans, PlanRevisionRepository revisions,
            CompetitionInputs inputs, SeriesRegistry series, RegistryArchivePolicy archives) {
        this.plans = plans;
        this.revisions = revisions;
        this.inputs = inputs;
        this.series = series;
        this.archives = archives;
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public View read(UUID id) {
        var row = plans.findById(id).orElse(null);
        return row == null ? new View(id, 0, null, inputs.snapshot(id, CompetitionPlan.empty())) : view(row);
    }

    @Transactional(readOnly = true)
    public View published(UUID id) {
        var row = plans.findById(id).filter(value -> value.getPublishedAt() != null)
                .orElseThrow(TournamentErrors::missing);
        return new View(id, 0, row.getPublishedAt(), row.getPublishedSnapshot());
    }

    @Transactional(readOnly = true)
    public PageSlice<View> published(PublishedFilter filter, int page, int size) {
        return PageSlice.from(plans
                .published(text(filter.teamId()), text(filter.playerId()), text(filter.organizerPageId()),
                        text(filter.circuitPageId()), PageRequest.of(page, size))
                .map(row -> new View(row.getId(), 0, row.getPublishedAt(), row.getPublishedSnapshot())));
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    @Transactional
    public View save(UUID id, Long version, CompetitionPlan content) {
        var actor = CommunityActor.require();
        archives.lockWrites();
        validate(content);
        var row = plans.lock(id).orElseGet(() -> new CompetitionPlanRecord(id));
        TournamentErrors.version(row.getVersion(), version);
        var snapshot = inputs.snapshot(id, content);
        consistent(snapshot);
        for (var match : content.matches()) {
            if (match.seriesId() == null) {
                continue;
            }
            var current = series.get(match.seriesId());
            var value = current.content();
            if (!Objects.equals(value.scheduledAt(), match.scheduledAt())
                    || !Objects.equals(value.name(), match.label())
                    || !Objects.equals(value.title(), match.title())
                    || !Objects.equals(value.stage(), match.stageCode())) {
                series.update(current.id(), current.version(),
                        value.planned(match.label(), match.stageCode(), match.scheduledAt(), match.title()),
                        actor.key());
            }
        }
        if (row.getContent() != null) {
            var retained = content.matches().stream().map(CompetitionPlan.Match::seriesId).filter(Objects::nonNull)
                    .toList();
            if (row.getContent().matches().stream()
                    .anyMatch(match -> match.seriesId() != null && !retained.contains(match.seriesId()))) {
                throw TournamentErrors.invalid("Linked matches cannot be removed from the competition plan.");
            }
        }
        row.save(snapshot.plan(), actor.key());
        plans.saveAndFlush(row);
        revisions.save(
                new PlanRevision(id, inputs.snapshot(id, row.getContent()), PlanRevisionAction.SAVE, actor.key()));
        return view(row);
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    @Transactional
    public View materialize(UUID id, Long version) {
        var actor = CommunityActor.require();
        archives.lockWrites();
        var row = locked(id, version);
        var snapshot = inputs.snapshot(id, row.getContent());
        consistent(snapshot);
        var matches = new ArrayList<CompetitionPlan.Match>();
        for (int i = 0; i < row.getContent().matches().size(); i++) {
            var match = row.getContent().matches().get(i);
            var resolved = snapshot.resolved().get(i);
            if (match.seriesId() == null && resolved.teamAId() != null && resolved.teamBId() != null) {
                var created = series.create(new Series("match-" + UUID.randomUUID(), id, match.label(),
                        match.stageCode(), resolved.teamAId(), resolved.teamBId(), match.bestOf(), match.scheduledAt(),
                        row.getContent().sourceUrl(), "", null, false, match.title()), actor.key());
                match = match.linked(created.id());
            }
            matches.add(match);
        }
        row.save(row.getContent().schedule(matches), actor.key());
        plans.flush();
        revisions.save(new PlanRevision(id, inputs.snapshot(id, row.getContent()), PlanRevisionAction.MATERIALIZE,
                actor.key()));
        return view(row);
    }

    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    @Transactional
    public View publish(UUID id, Long version) {
        var actor = CommunityActor.require();
        archives.lockWrites();
        var row = locked(id, version);
        var snapshot = inputs.snapshot(id, row.getContent(), true);
        consistent(snapshot);
        if (row.getContent().entrants().size() < 2 || row.getContent().stages().isEmpty()
                || row.getContent().sourceUrl() == null || row.getContent().sourceUrl().isBlank()) {
            throw TournamentErrors.invalid("Publication requires entrants, stages and a source URL.");
        }

        row.publish(snapshot, actor.key());
        plans.flush();
        revisions.save(new PlanRevision(id, snapshot, PlanRevisionAction.PUBLISH, actor.key()));
        return view(row);
    }

    /** Takes the plan out of public view; the withdrawal is kept in the plan history. */
    @PreAuthorize("hasAuthority('tournament:publish') and hasAuthority('tournament:read')")
    @Transactional
    public View withdraw(UUID id, Long version) {
        var actor = CommunityActor.require();
        archives.lockWrites();
        var row = locked(id, version);
        var snapshot = inputs.snapshot(id, row.getContent(), false);
        consistent(snapshot);

        row.publish(null, actor.key());
        plans.flush();
        revisions.save(new PlanRevision(id, snapshot, PlanRevisionAction.WITHDRAW, actor.key()));
        return view(row);
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<CompetitionPlan.Match> preview(CompetitionPlan content, String stageCode, int opponent) {
        validate(content);
        var stage = content.stages().stream().filter(value -> value.code().equals(stageCode)).findFirst()
                .orElseThrow(() -> TournamentErrors.invalid("Unknown stage."));
        try {
            return switch (stage.format()) {
                case "ROUND_ROBIN" -> CompetitionRules.roundRobin(stage, content.entrants());
                case "DOUBLE_ELIMINATION" -> {
                    if (content.entrants().stream().filter(CompetitionPlan.Entry::plays)
                            .count() < CompetitionRules.AOG_PLAYOFF_TEAMS) {
                        throw TournamentErrors.invalid("The AOG playoff template requires six entrants.");
                    }
                    yield CompetitionRules.aogPlayoffs(stage, opponent);
                }
                default -> throw TournamentErrors.invalid("This format uses manual fixtures.");
            };
        } catch (IllegalArgumentException error) {
            throw TournamentErrors.invalid(error.getMessage());
        }
    }

    private static String text(@Nullable UUID id) {
        return id == null ? "" : id.toString();
    }

    private CompetitionPlanRecord locked(UUID id, Long version) {
        var row = plans.lock(id).orElseThrow(TournamentErrors::missing);
        TournamentErrors.version(row.getVersion(), version);
        return row;
    }

    private View view(CompetitionPlanRecord row) {
        return new View(row.getId(), row.getVersion(), row.getPublishedAt(),
                inputs.snapshot(row.getId(), row.getContent()));
    }

    private static void consistent(CompetitionSnapshot snapshot) {
        if (snapshot.resolved().stream().anyMatch(match -> !match.consistent())) {
            throw TournamentErrors.invalid(
                    "A linked match no longer agrees with its participant slots or best-of. Review downstream results first.");
        }
    }

    private static void validate(CompetitionPlan plan) {
        try {
            CompetitionRules.validate(plan);
        } catch (IllegalArgumentException | DateTimeException error) {
            throw TournamentErrors.invalid(error.getMessage());
        }
        if (!SourceUrls.valid(plan.sourceUrl())
                || plan.stages().stream().anyMatch(stage -> !SourceUrls.valid(stage.sourceUrl()))) {
            throw TournamentErrors.invalid("Source URLs must be absolute HTTP or HTTPS URLs without credentials.");
        }
    }
}
