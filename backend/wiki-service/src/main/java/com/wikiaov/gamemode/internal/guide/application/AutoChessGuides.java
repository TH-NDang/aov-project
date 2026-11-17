package com.wikiaov.gamemode.internal.guide.application;

import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateGuideDraft;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.GameModeCommands.UpdateGuide;
import com.wikiaov.gamemode.internal.application.GameModeErrorCode;
import com.wikiaov.gamemode.internal.application.GameModeImages;
import com.wikiaov.gamemode.internal.application.RevisionWorkflow;
import com.wikiaov.gamemode.internal.application.response.GameModeViews;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminGuide;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicGuide;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.gamemode.internal.catalog.application.GameModeCatalog;
import com.wikiaov.gamemode.internal.catalog.persistence.entity.GameMode;
import com.wikiaov.gamemode.internal.domain.AutoChessContent;
import com.wikiaov.gamemode.internal.guide.domain.AutoChessContentRules;
import com.wikiaov.gamemode.internal.guide.persistence.AutoChessRevisionRepository;
import com.wikiaov.gamemode.internal.guide.persistence.entity.AutoChessRevision;
import com.wikiaov.gamemode.internal.lineup.application.LineupLikeCounts;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RevisionState;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The auto-chess guide of a mode: admin drafts and publication, and the published guide read by the Wiki. */
@Service
@Transactional
public class AutoChessGuides {
    private static final String AGGREGATE = "AUTO_CHESS_GUIDE";

    private static final String AUTO_CHESS = "AUTO_CHESS";

    private final GameModeCatalog catalog;

    private final AutoChessRevisionRepository revisions;

    private final GameModeImages images;

    private final RevisionWorkflow workflow;

    private final LineupLikeCounts likeCounts;

    public AutoChessGuides(GameModeCatalog catalog, AutoChessRevisionRepository revisions, GameModeImages images,
            RevisionWorkflow workflow, LineupLikeCounts likeCounts) {
        this.catalog = catalog;
        this.revisions = revisions;
        this.images = images;
        this.workflow = workflow;
        this.likeCounts = likeCounts;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public AdminGuide current(UUID modeId) {
        var mode = catalog.requireMode(modeId);
        var revision = revisions.findByModeIdAndState(modeId, RevisionState.DRAFT)
                .or(() -> latestPublished(modeId)).orElseThrow(AutoChessGuides::guideNotFound);
        return adminView(mode, revision);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Revision> history(UUID modeId) {
        catalog.requireMode(modeId);
        return revisions.findByModeIdOrderByRevisionNoDesc(modeId).stream().map(Revision::of).toList();
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public AdminGuide revision(UUID modeId, UUID revisionId) {
        return adminView(catalog.requireMode(modeId), requireRevision(modeId, revisionId));
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminGuide createDraft(UUID modeId, CreateGuideDraft input) {
        var mode = catalog.lock(modeId);
        requireAutoChessMode(modeId);
        var open = revisions.findByModeIdAndState(modeId, RevisionState.DRAFT);
        workflow.requireNoOpenDraft(open.isPresent(), open.map(AutoChessRevision::getId).orElse(null));
        var published = latestPublished(modeId);

        AutoChessContent content;
        if (published.isPresent()) {
            if (input.content() != null)
                throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT,
                        "A published guide exists; start from it instead of new content.");
            content = published.get().getContent();
        } else {
            content = input.content() == null
                    ? revisions.findByModeIdOrderByRevisionNoDesc(modeId).stream().findFirst()
                            .map(AutoChessRevision::getContent).orElse(AutoChessContent.empty())
                    : AutoChessContentRules.assignLineupIds(input.content(), UUID::randomUUID);
        }
        workflow.rejectInvalid(AutoChessContentRules.validate(content));

        var draft = newRevision(modeId, content, published.map(AutoChessRevision::getId).orElse(null),
                input.changeNote());
        workflow.record("AUTO_CHESS_DRAFT_CREATED", AGGREGATE, modeId, draft, null, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminGuide update(UUID modeId, UUID revisionId, UpdateGuide input) {
        var mode = catalog.lock(modeId);
        var draft = workflow.requireEditableDraft(requireRevision(modeId, revisionId), input.expectedVersion());
        var content = AutoChessContentRules.assignLineupIds(input.content(), UUID::randomUUID);
        workflow.rejectInvalid(AutoChessContentRules.validate(content));
        if (draft.getContent().equals(content))
            return adminView(mode, draft);

        long before = draft.getVersion();
        draft.setContent(content);
        workflow.advance(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("AUTO_CHESS_DRAFT_UPDATED", AGGREGATE, modeId, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:publish')")
    public AdminGuide publish(UUID modeId, UUID revisionId, Mutation input) {
        var mode = catalog.lock(modeId);
        requireAutoChessMode(modeId);
        var draft = workflow.requireEditableDraft(requireRevision(modeId, revisionId), input.expectedVersion());
        var content = draft.getContent();
        workflow.rejectInvalid(AutoChessContentRules.validate(content));
        workflow.rejectIncomplete(AutoChessContentRules.missingFields(content));
        images.requirePublishable(expectedImages(content));

        long before = draft.getVersion();
        workflow.publish(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("AUTO_CHESS_PUBLISHED", AGGREGATE, modeId, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminGuide discard(UUID modeId, UUID revisionId, Mutation input) {
        var mode = catalog.lock(modeId);
        var draft = workflow.requireEditableDraft(requireRevision(modeId, revisionId), input.expectedVersion());

        long before = draft.getVersion();
        workflow.discard(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("AUTO_CHESS_DRAFT_DISCARDED", AGGREGATE, modeId, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @Transactional(readOnly = true)
    public PublicGuide published(String modeCode) {
        var mode = catalog.requireModeByCode(modeCode);
        var modeRevision = catalog.latestPublished(mode.getId())
                .filter(r -> AUTO_CHESS.equals(r.getContent().guideKind()))
                .orElseThrow(AutoChessGuides::guideNotFound);
        var revision = latestPublished(mode.getId()).orElseThrow(AutoChessGuides::guideNotFound);
        var content = revision.getContent();
        var lineupIds = content.lineups().stream().map(AutoChessContent.Lineup::id).toList();

        return new PublicGuide(mode.getCode(), modeRevision.getContent().name(), GameModeViews.CONTENT_LOCALE,
                revision.getId(), revision.getPublishedAt(), content,
                images.hydrate(AutoChessContentRules.assets(content)), likeCounts.counts(mode.getId(), lineupIds));
    }

    /** The published guide of a published auto-chess mode, for the lineup services of this module. */
    public Published requirePublished(String modeCode) {
        var mode = catalog.requireModeByCode(modeCode);
        boolean autoChess = catalog.latestPublished(mode.getId())
                .map(r -> AUTO_CHESS.equals(r.getContent().guideKind())).orElse(false);
        var revision = latestPublished(mode.getId()).filter(r -> autoChess)
                .orElseThrow(AutoChessGuides::guideNotFound);
        return new Published(mode, revision.getContent());
    }

    public record Published(
            GameMode mode,
            AutoChessContent content
    ) {
    }

    public List<MediaUsage> usages(UUID assetId) {
        return allUsages().getOrDefault(assetId, List.of());
    }

    public Map<UUID, List<MediaUsage>> allUsages() {
        var all = revisions.findByStateNot(RevisionState.DISCARDED);
        var newest = new HashMap<UUID, Long>();
        all.stream().filter(r -> r.getState() == RevisionState.PUBLISHED)
                .forEach(r -> newest.merge(r.getModeId(), r.getRevisionNo(), Math::max));
        var usages = new HashMap<UUID, List<MediaUsage>>();
        for (var revision : all) {
            var scope = revision.getState() == RevisionState.DRAFT
                    ? MediaUsageScope.DRAFT
                    : newest.get(revision.getModeId()) == revision.getRevisionNo()
                            ? MediaUsageScope.CURRENT
                            : MediaUsageScope.HISTORICAL;
            var content = revision.getContent();
            var edition = content.edition();
            for (var trait : content.traits())
                add(usages, trait.iconAssetId(), revision, "TRAIT_ICON", scope, edition, trait.name());
            for (var unit : content.units()) {
                add(usages, unit.portraitAssetId(), revision, "UNIT_PORTRAIT", scope, edition, unit.name());
                if (unit.skill() != null)
                    add(usages, unit.skill().iconAssetId(), revision, "SKILL_ICON", scope, edition, unit.name());
            }
            for (var group : content.itemGroups())
                add(usages, group.iconAssetId(), revision, "ITEM_GROUP_ICON", scope, edition, group.name());
            for (var item : content.items())
                add(usages, item.iconAssetId(), revision, "ITEM_ICON", scope, edition, item.name());
            for (var blessing : content.blessings())
                add(usages, blessing.iconAssetId(), revision, "BLESSING_ICON", scope, edition, blessing.name());
        }
        return usages;
    }

    private static void add(Map<UUID, List<MediaUsage>> usages, UUID assetId, AutoChessRevision revision,
            String role, MediaUsageScope scope, String owner, String part) {
        if (assetId == null)
            return;
        usages.computeIfAbsent(assetId, key -> new ArrayList<>()).add(new MediaUsage("GAMEMODE", AGGREGATE,
                revision.getModeId(), revision.getId(), role, scope).named(owner, part));
    }

    private Optional<AutoChessRevision> latestPublished(UUID modeId) {
        return revisions.findFirstByModeIdAndStateOrderByRevisionNoDesc(modeId, RevisionState.PUBLISHED);
    }

    private void requireAutoChessMode(UUID modeId) {
        boolean autoChess = catalog.workingContent(modeId).map(c -> AUTO_CHESS.equals(c.guideKind())).orElse(false);
        if (!autoChess)
            throw new ApiException(GameModeErrorCode.GAME_MODE_INVALID_CONTENT,
                    "Set the mode's guide kind to AUTO_CHESS before editing its guide.");
    }

    private Map<UUID, Set<MediaSemanticType>> expectedImages(AutoChessContent content) {
        var expected = new HashMap<UUID, Set<MediaSemanticType>>();
        AutoChessContentRules.assets(content).forEach(id -> expected.put(id, GameModeImages.ICONS));
        return expected;
    }

    private AutoChessRevision newRevision(UUID modeId, AutoChessContent content, UUID sourceId, String note) {
        var actor = workflow.actor();
        var now = workflow.now();
        var revision = new AutoChessRevision();
        revision.setId(UUID.randomUUID());
        revision.setModeId(modeId);
        revision.setRevisionNo(revisions.maxRevisionNo(modeId) + 1);
        revision.setState(RevisionState.DRAFT);
        revision.setVersion(1);
        revision.setContent(content);
        revision.setSourceRevisionId(sourceId);
        revision.setChangeNote(note);
        revision.setCreatedAt(now);
        revision.setCreatedByIssuer(actor.issuer());
        revision.setCreatedBySubject(actor.subject());
        revision.touch(actor.issuer(), actor.subject(), now);
        return revisions.saveAndFlush(revision);
    }

    private AutoChessRevision requireRevision(UUID modeId, UUID revisionId) {
        return revisions.findByIdAndModeId(revisionId, modeId).orElseThrow(
                () -> new ApiException(GameModeErrorCode.GAME_MODE_REVISION_NOT_FOUND, "The revision was not found."));
    }

    private AdminGuide adminView(GameMode mode, AutoChessRevision revision) {
        var content = revision.getContent();
        return new AdminGuide(mode.getId(), mode.getCode(), Revision.of(revision),
                latestPublished(mode.getId()).isPresent(), content, AutoChessContentRules.missingFields(content),
                images.hydrate(AutoChessContentRules.assets(content)));
    }

    private static ApiException guideNotFound() {
        return new ApiException(GameModeErrorCode.GAME_MODE_GUIDE_NOT_FOUND, "The mode has no published guide.");
    }
}
