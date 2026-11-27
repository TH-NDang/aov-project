package com.wikiaov.gamemode.internal.mapguide.application;

import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.GameModeErrorCode;
import com.wikiaov.gamemode.internal.application.GameModeImages;
import com.wikiaov.gamemode.internal.application.RevisionWorkflow;
import com.wikiaov.gamemode.internal.application.response.GameModeViews;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminMap;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicMap;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.gamemode.internal.catalog.application.GameModeCatalog;
import com.wikiaov.gamemode.internal.catalog.persistence.entity.GameMode;
import com.wikiaov.gamemode.internal.domain.MapGuideContent;
import com.wikiaov.gamemode.internal.mapguide.domain.MapGuideContentRules;
import com.wikiaov.gamemode.internal.mapguide.persistence.MapGuideRevisionRepository;
import com.wikiaov.gamemode.internal.mapguide.persistence.entity.MapGuideRevision;
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

/** The battlefield map of a mode: admin drafts and publication, and the published map read by the Wiki. */
@Service
@Transactional
public class MapGuides {
    private static final String AGGREGATE = "MAP_GUIDE";

    private final GameModeCatalog catalog;

    private final MapGuideRevisionRepository revisions;

    private final GameModeImages images;

    private final RevisionWorkflow workflow;

    public MapGuides(GameModeCatalog catalog, MapGuideRevisionRepository revisions, GameModeImages images,
            RevisionWorkflow workflow) {
        this.catalog = catalog;
        this.revisions = revisions;
        this.images = images;
        this.workflow = workflow;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public AdminMap current(UUID modeId) {
        var mode = catalog.requireMode(modeId);
        var revision = revisions.findByModeIdAndState(modeId, RevisionState.DRAFT)
                .or(() -> latestPublished(modeId)).orElseThrow(MapGuides::mapNotFound);
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
    public AdminMap revision(UUID modeId, UUID revisionId) {
        return adminView(catalog.requireMode(modeId), requireRevision(modeId, revisionId));
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminMap createDraft(UUID modeId, CreateMapDraftCommand input) {
        var mode = catalog.lock(modeId);
        var open = revisions.findByModeIdAndState(modeId, RevisionState.DRAFT);
        workflow.requireNoOpenDraft(open.isPresent(), open.map(MapGuideRevision::getId).orElse(null));
        var published = latestPublished(modeId);

        MapGuideContent content;
        if (published.isPresent()) {
            if (input.content() != null) {
                throw new ApiException(GameModeErrorCode.GAME_MODE_CONFLICT,
                        "A published map exists; start from it instead of new content.");
            }
            content = published.get().getContent();
        } else {
            content = input.content() == null
                    ? revisions.findByModeIdOrderByRevisionNoDesc(modeId).stream().findFirst()
                            .map(MapGuideRevision::getContent).orElse(MapGuideContent.empty())
                    : input.content();
        }
        workflow.rejectInvalid(MapGuideContentRules.validate(content));

        var draft = newRevision(modeId, content, published.map(MapGuideRevision::getId).orElse(null),
                input.changeNote());
        workflow.record("MAP_GUIDE_DRAFT_CREATED", AGGREGATE, modeId, draft, null, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminMap update(UUID modeId, UUID revisionId, UpdateMapCommand input) {
        var mode = catalog.lock(modeId);
        var draft = workflow.requireEditableDraft(requireRevision(modeId, revisionId), input.expectedVersion());
        var content = input.content();
        workflow.rejectInvalid(MapGuideContentRules.validate(content));
        if (draft.getContent().equals(content)) {
            return adminView(mode, draft);
        }

        long before = draft.getVersion();
        draft.setContent(content);
        workflow.advance(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("MAP_GUIDE_DRAFT_UPDATED", AGGREGATE, modeId, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:publish')")
    public AdminMap publish(UUID modeId, UUID revisionId, Mutation input) {
        var mode = catalog.lock(modeId);
        var draft = workflow.requireEditableDraft(requireRevision(modeId, revisionId), input.expectedVersion());
        var content = draft.getContent();
        workflow.rejectInvalid(MapGuideContentRules.validate(content));
        workflow.rejectIncomplete(MapGuideContentRules.missingFields(content));
        images.requirePublishable(expectedImages(content));

        long before = draft.getVersion();
        workflow.publish(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("MAP_GUIDE_PUBLISHED", AGGREGATE, modeId, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminMap discard(UUID modeId, UUID revisionId, Mutation input) {
        var mode = catalog.lock(modeId);
        var draft = workflow.requireEditableDraft(requireRevision(modeId, revisionId), input.expectedVersion());

        long before = draft.getVersion();
        workflow.discard(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("MAP_GUIDE_DRAFT_DISCARDED", AGGREGATE, modeId, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    /** The published map of a published mode. */
    @Transactional(readOnly = true)
    public PublicMap published(String modeCode) {
        var mode = catalog.requireModeByCode(modeCode);
        var modeRevision = catalog.latestPublished(mode.getId()).orElseThrow(MapGuides::mapNotFound);
        var revision = latestPublished(mode.getId()).orElseThrow(MapGuides::mapNotFound);
        var content = revision.getContent();

        return new PublicMap(mode.getCode(), modeRevision.getContent().name(), GameModeViews.CONTENT_LOCALE,
                revision.getId(), revision.getPublishedAt(), content,
                images.hydrate(MapGuideContentRules.assets(content)));
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
            var background = revision.getContent().backgroundAssetId();
            if (background == null) {
                continue;
            }
            var scope = revision.getState() == RevisionState.DRAFT
                    ? MediaUsageScope.DRAFT
                    : newest.get(revision.getModeId()) == revision.getRevisionNo()
                            ? MediaUsageScope.CURRENT
                            : MediaUsageScope.HISTORICAL;
            usages.computeIfAbsent(background, key -> new ArrayList<>()).add(new MediaUsage("GAMEMODE", AGGREGATE,
                    revision.getModeId(), revision.getId(), "MAP_BACKGROUND", scope)
                    .named(revision.getContent().name(), null));
        }

        return usages;
    }

    private Optional<MapGuideRevision> latestPublished(UUID modeId) {
        return revisions.findFirstByModeIdAndStateOrderByRevisionNoDesc(modeId, RevisionState.PUBLISHED);
    }

    private static Map<UUID, Set<MediaSemanticType>> expectedImages(MapGuideContent content) {
        var expected = new HashMap<UUID, Set<MediaSemanticType>>();
        MapGuideContentRules.assets(content).forEach(id -> expected.put(id, GameModeImages.MODE_ART));
        return expected;
    }

    private MapGuideRevision newRevision(UUID modeId, MapGuideContent content, UUID sourceId, String note) {
        var actor = workflow.actor();
        var now = workflow.now();
        var revision = new MapGuideRevision();
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

    private MapGuideRevision requireRevision(UUID modeId, UUID revisionId) {
        return revisions.findByIdAndModeId(revisionId, modeId).orElseThrow(
                () -> new ApiException(GameModeErrorCode.GAME_MODE_REVISION_NOT_FOUND, "The revision was not found."));
    }

    private AdminMap adminView(GameMode mode, MapGuideRevision revision) {
        var content = revision.getContent();
        return new AdminMap(mode.getId(), mode.getCode(), Revision.of(revision),
                latestPublished(mode.getId()).isPresent(), content, MapGuideContentRules.missingFields(content),
                images.hydrate(MapGuideContentRules.assets(content)));
    }

    private static ApiException mapNotFound() {
        return new ApiException(GameModeErrorCode.GAME_MODE_MAP_NOT_FOUND, "The mode has no published map.");
    }
}
