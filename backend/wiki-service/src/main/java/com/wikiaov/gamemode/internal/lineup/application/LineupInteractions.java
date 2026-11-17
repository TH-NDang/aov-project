package com.wikiaov.gamemode.internal.lineup.application;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.gamemode.internal.application.GameModeCommands.SaveLineup;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Visibility;
import com.wikiaov.gamemode.internal.application.GameModeErrorCode;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Insights;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.LikeCount;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.LikeState;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.MyState;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.OwnLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicLineup;
import com.wikiaov.gamemode.internal.catalog.application.GameModeCatalog;
import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import com.wikiaov.gamemode.internal.guide.application.AutoChessGuides;
import com.wikiaov.gamemode.internal.lineup.domain.CommunityLineupRules;
import com.wikiaov.gamemode.internal.lineup.domain.LineupInsights;
import com.wikiaov.gamemode.internal.lineup.persistence.CommunityLineupRepository;
import com.wikiaov.gamemode.internal.lineup.persistence.LineupLikeRepository;
import com.wikiaov.gamemode.internal.lineup.persistence.entity.CommunityLineup;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What signed-in readers do with lineups: like editorial and community lineups once each, save their own lineups,
 * and the public rankings and analysis built from them (ADR-023).
 */
@Service
@Transactional
public class LineupInteractions {
    public static final Set<String> SORTS = Set.of("popular", "trending", "recent");
    /** The largest page of community lineups a reader asks for. */
    public static final int MAX_PAGE_SIZE = 50;

    static final int INSIGHT_SAMPLE = 2000;

    private static final String AGGREGATE = "COMMUNITY_LINEUP";

    private final GameModeCatalog catalog;

    private final AutoChessGuides guides;

    private final CommunityLineupRepository lineups;

    private final LineupLikeRepository likes;

    private final LineupLikeCounts likeCounts;

    private final LineupThrottle throttle;

    private final CurrentActor actors;

    private final AuditLog audit;

    private final Clock clock;

    public LineupInteractions(GameModeCatalog catalog, AutoChessGuides guides, CommunityLineupRepository lineups,
            LineupLikeRepository likes, LineupLikeCounts likeCounts, LineupThrottle throttle, CurrentActor actors,
            AuditLog audit, Clock clock) {
        this.catalog = catalog;
        this.guides = guides;
        this.lineups = lineups;
        this.likes = likes;
        this.likeCounts = likeCounts;
        this.throttle = throttle;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    public LikeState like(String modeCode, UUID lineupId) {
        var reader = reader();
        var guide = guides.requirePublished(modeCode);
        var modeId = guide.mode().getId();
        String source = likeTarget(guide, lineupId, reader);
        throttle.like(key(reader));

        likes.insertIfAbsent(lineupId, reader.issuer(), reader.subject(), modeId, source, clock.instant());

        return new LikeState(lineupId, true, likes.countByLineup(lineupId));
    }

    public LikeState unlike(String modeCode, UUID lineupId) {
        var reader = reader();
        var guide = guides.requirePublished(modeCode);
        throttle.like(key(reader));

        int removed = likes.deleteLike(lineupId, reader.issuer(), reader.subject());
        if (removed == 0 && !exists(guide, lineupId))
            throw lineupNotFound();

        return new LikeState(lineupId, false, likes.countByLineup(lineupId));
    }

    @Transactional(readOnly = true)
    public MyState me(String modeCode) {
        var reader = reader();
        var mode = catalog.requireModeByCode(modeCode);
        var own = lineups.findByModeIdAndAuthorIssuerAndAuthorSubjectOrderByUpdatedAtDesc(mode.getId(),
                reader.issuer(), reader.subject());
        var counts = likeCounts.counts(mode.getId(), own.stream().map(l -> l.getId()).toList());

        return new MyState(likes.likedBy(mode.getId(), reader.issuer(), reader.subject()),
                own.stream().map(l -> ownView(l, counts.get(l.getId()))).toList());
    }

    public OwnLineup create(String modeCode, SaveLineup input) {
        var reader = reader();
        var guide = guides.requirePublished(modeCode);
        var modeId = guide.mode().getId();
        catalog.lock(modeId);
        throttle.write(key(reader));
        validate(input, guide.content());
        if (lineups.countByModeIdAndAuthorIssuerAndAuthorSubject(modeId, reader.issuer(),
                reader.subject()) >= CommunityLineupRules.MAX_PER_AUTHOR)
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT,
                    "You already saved the maximum number of lineups for this mode.",
                    Map.of("limit", CommunityLineupRules.MAX_PER_AUTHOR));

        var now = clock.instant();
        var lineup = new CommunityLineup();
        lineup.setId(UUID.randomUUID());
        lineup.setModeId(modeId);
        lineup.setAuthorIssuer(reader.issuer());
        lineup.setAuthorSubject(reader.subject());
        apply(lineup, input);
        lineup.setStatus(CommunityLineup.VISIBLE);
        lineup.setVersion(1);
        lineup.setCreatedAt(now);
        lineup.setUpdatedAt(now);
        lineups.saveAndFlush(lineup);

        return ownView(lineup, new LikeCount(0, 0));
    }

    public OwnLineup update(String modeCode, UUID lineupId, SaveLineup input) {
        var reader = reader();
        var guide = guides.requirePublished(modeCode);
        var lineup = ownedLineup(guide.mode().getId(), lineupId, reader);
        if (input.expectedVersion() == null || lineup.getVersion() != input.expectedVersion())
            throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT, "The lineup has changed.",
                    Map.of("currentVersion", lineup.getVersion()));
        throttle.write(key(reader));
        validate(input, guide.content());

        apply(lineup, input);
        lineup.setVersion(lineup.getVersion() + 1);
        lineup.setUpdatedAt(clock.instant());
        lineups.saveAndFlush(lineup);

        return ownView(lineup, likeCounts.counts(lineup.getModeId(), List.of(lineupId)).get(lineupId));
    }

    public void delete(String modeCode, UUID lineupId, long expectedVersion) {
        var reader = reader();
        var mode = catalog.requireModeByCode(modeCode);
        var lineup = ownedLineup(mode.getId(), lineupId, reader);
        if (lineup.getVersion() != expectedVersion)
            throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT, "The lineup has changed.",
                    Map.of("currentVersion", lineup.getVersion()));

        likes.deleteByLineup(lineupId);
        lineups.delete(lineup);
    }

    @Transactional(readOnly = true)
    public PageSlice<PublicLineup> community(String modeCode, String sort, String unit, int page, int size) {
        var guide = guides.requirePublished(modeCode);
        var modeId = guide.mode().getId();
        var since = likeCounts.trendStart();

        var ids = lineups.rankedIds(modeId, since, unit, sort, size, (long) page * size);
        var found = lineups.findAllById(ids).stream()
                .collect(Collectors.toMap(l -> l.getId(), Function.identity()));
        var counts = likeCounts.counts(modeId, ids);
        var items = ids.stream().map(found::get).filter(java.util.Objects::nonNull)
                .map(l -> publicView(l, counts.get(l.getId()))).toList();

        return new PageSlice<>(items, page, size, lineups.countVisible(modeId, unit));
    }

    @Transactional(readOnly = true)
    public Insights insights(String modeCode) {
        var guide = guides.requirePublished(modeCode);
        var modeId = guide.mode().getId();
        var content = guide.content();

        var editorialIds = content.lineups().stream().map(AutoChessContent.Lineup::id).toList();
        var editorialCounts = likeCounts.counts(modeId, editorialIds);
        var samples = new ArrayList<LineupInsights.Sample>();
        content.lineups().forEach(lineup -> samples.add(new LineupInsights.Sample(lineup.units(), lineup.emblems(),
                editorialCounts.get(lineup.id()).likes())));
        var communityIds = lineups.rankedIds(modeId, likeCounts.trendStart(), null, "popular", INSIGHT_SAMPLE, 0);
        var communityCounts = likeCounts.counts(modeId, communityIds);
        lineups.findAllById(communityIds).forEach(lineup -> samples.add(new LineupInsights.Sample(lineup.getUnits(),
                lineup.getEmblems(), communityCounts.get(lineup.getId()).likes())));

        var summary = LineupInsights.summarize(content, samples);
        return new Insights(summary.lineupCount(), communityIds.size(), summary.units(), summary.traits(),
                summary.costs());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<AdminLineup> adminList(UUID modeId, String status, int page, int size) {
        catalog.requireMode(modeId);
        var request = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "updatedAt"));
        var result = status == null
                ? lineups.findByModeId(modeId, request)
                : lineups.findByModeIdAndStatus(modeId, status, request);
        var counts = likeCounts.counts(modeId, result.getContent().stream().map(l -> l.getId()).toList());

        return new PageSlice<>(result.getContent().stream().map(l -> adminView(l, counts.get(l.getId()))).toList(),
                page, size, result.getTotalElements());
    }

    @PreAuthorize("hasAuthority('gamemode:publish')")
    public AdminLineup visibility(UUID modeId, UUID lineupId, Visibility input) {
        catalog.lock(modeId);
        var lineup = lineups.findByIdAndModeId(lineupId, modeId).orElseThrow(LineupInteractions::lineupNotFound);
        if (lineup.getVersion() != input.expectedVersion())
            throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT, "The lineup has changed.",
                    Map.of("currentVersion", lineup.getVersion()));
        String reason = input.reason() == null || input.reason().isBlank() ? null : input.reason().strip();
        if (input.hidden() && reason == null)
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT, "Give a reason for hiding a lineup.");

        long before = lineup.getVersion();
        lineup.setStatus(input.hidden() ? CommunityLineup.HIDDEN : CommunityLineup.VISIBLE);
        lineup.setHiddenReason(input.hidden() ? reason : null);
        lineup.setVersion(before + 1);
        lineups.saveAndFlush(lineup);
        audit.record(new AuditEntry(actors.require(), input.hidden() ? "LINEUP_HIDDEN" : "LINEUP_SHOWN", AGGREGATE,
                lineupId, null, before, lineup.getVersion(), reason, Map.of("modeId", modeId.toString())));

        return adminView(lineup, likeCounts.counts(modeId, List.of(lineupId)).get(lineupId));
    }

    private String likeTarget(AutoChessGuides.Published guide, UUID lineupId, Actor reader) {
        if (guide.content().lineups().stream().anyMatch(lineup -> lineupId.equals(lineup.id())))
            return "EDITORIAL";
        var lineup = lineups.findByIdAndModeId(lineupId, guide.mode().getId())
                .filter(l -> CommunityLineup.VISIBLE.equals(l.getStatus()))
                .orElseThrow(LineupInteractions::lineupNotFound);
        if (lineup.authoredBy(reader.issuer(), reader.subject()))
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT, "You cannot like your own lineup.");
        return "COMMUNITY";
    }

    private boolean exists(AutoChessGuides.Published guide, UUID lineupId) {
        return guide.content().lineups().stream().anyMatch(lineup -> lineupId.equals(lineup.id()))
                || lineups.findByIdAndModeId(lineupId, guide.mode().getId()).isPresent();
    }

    private CommunityLineup ownedLineup(UUID modeId,
            UUID lineupId, Actor reader) {
        var lineup = lineups.findByIdAndModeId(lineupId, modeId).orElseThrow(LineupInteractions::lineupNotFound);
        if (!lineup.authoredBy(reader.issuer(), reader.subject()))
            throw new ApiException(GameModeErrorCode.GAME_MODE_FORBIDDEN, "Only the author can change this lineup.");
        return lineup;
    }

    private static void validate(SaveLineup input, AutoChessContent guide) {
        var errors = CommunityLineupRules.validate(input.name(), input.note(), input.units(), input.emblems(), guide);
        if (!errors.isEmpty())
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT, "The lineup is not valid.", errors);
    }

    private static void apply(CommunityLineup lineup,
            SaveLineup input) {
        lineup.setName(input.name().strip());
        lineup.setNote(input.note() == null || input.note().isBlank() ? null : input.note().strip());
        lineup.setUnits(List.copyOf(input.units()));
        lineup.setEmblems(List.copyOf(input.emblems()));
    }

    private Actor reader() {
        var actor = actors.require();
        if (actor.type() != ActorType.HUMAN)
            throw new ApiException(GameModeErrorCode.GAME_MODE_FORBIDDEN, "Only people can like or save lineups.");
        return actor;
    }

    private static String key(Actor actor) {
        return actor.issuer() + "\n" + actor.subject();
    }

    private static PublicLineup publicView(
            CommunityLineup lineup, LikeCount count) {
        return new PublicLineup(lineup.getId(), lineup.getName(), lineup.getNote(), lineup.getUnits(),
                lineup.getEmblems(), count.likes(), count.recentLikes(), lineup.getCreatedAt(), lineup.getUpdatedAt());
    }

    private static OwnLineup ownView(CommunityLineup lineup,
            LikeCount count) {
        return new OwnLineup(lineup.getId(), lineup.getName(), lineup.getNote(), lineup.getUnits(),
                lineup.getEmblems(), lineup.getStatus(), lineup.getVersion(), count.likes(), lineup.getCreatedAt(),
                lineup.getUpdatedAt());
    }

    private static AdminLineup adminView(
            CommunityLineup lineup, LikeCount count) {
        return new AdminLineup(lineup.getId(), lineup.getName(), lineup.getNote(), lineup.getUnits(),
                lineup.getEmblems(), lineup.getStatus(), lineup.getHiddenReason(), lineup.getAuthorSubject(),
                lineup.getVersion(), count.likes(), lineup.getCreatedAt(), lineup.getUpdatedAt());
    }

    private static ApiException lineupNotFound() {
        return new ApiException(GameModeErrorCode.GAME_MODE_LINEUP_NOT_FOUND, "The lineup was not found.");
    }
}
