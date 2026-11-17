package com.wikiaov.gamemode.internal.catalog.application;

import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateDraft;
import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateMode;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.GameModeCommands.UpdateMode;
import com.wikiaov.gamemode.internal.application.GameModeErrorCode;
import com.wikiaov.gamemode.internal.application.GameModeImages;
import com.wikiaov.gamemode.internal.application.RevisionWorkflow;
import com.wikiaov.gamemode.internal.application.response.GameModeViews;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminMode;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminSummary;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Card;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.CardList;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.GuideState;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicMode;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.gamemode.internal.catalog.domain.GameModeContentRules;
import com.wikiaov.gamemode.internal.catalog.persistence.GameModeRepository;
import com.wikiaov.gamemode.internal.catalog.persistence.GameModeRevisionRepository;
import com.wikiaov.gamemode.internal.catalog.persistence.entity.GameMode;
import com.wikiaov.gamemode.internal.catalog.persistence.entity.GameModeRevision;
import com.wikiaov.gamemode.internal.domain.GameModeContent;
import com.wikiaov.gamemode.internal.domain.RevisionRecord;
import com.wikiaov.gamemode.internal.guide.persistence.AutoChessRevisionRepository;
import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.RevisionState;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Game mode catalog: admin drafts and publication, and the published catalog read by the Wiki. */
@Service
@Transactional
public class GameModeCatalog {
    private static final String AGGREGATE = "GAME_MODE";

    private final GameModeRepository modes;

    private final GameModeRevisionRepository revisions;

    private final AutoChessRevisionRepository guideRevisions;

    private final GameModeImages images;

    private final RevisionWorkflow workflow;

    public GameModeCatalog(GameModeRepository modes, GameModeRevisionRepository revisions,
            AutoChessRevisionRepository guideRevisions, GameModeImages images, RevisionWorkflow workflow) {
        this.modes = modes;
        this.revisions = revisions;
        this.guideRevisions = guideRevisions;
        this.images = images;
        this.workflow = workflow;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<AdminSummary> adminList() {
        var all = modes.findAll();
        var byMode = revisions.findByStateNot(RevisionState.DISCARDED).stream()
                .collect(Collectors.groupingBy(GameModeRevision::getModeId));
        var guides = guideRevisions.findByStateNot(RevisionState.DISCARDED).stream()
                .collect(Collectors.groupingBy(r -> r.getModeId()));
        var art = images.hydrate(all.stream()
                .map(mode -> latest(byMode.getOrDefault(mode.getId(), List.of())))
                .filter(r -> r != null && r.getContent().artAssetId() != null)
                .map(r -> r.getContent().artAssetId()).toList());

        return all.stream().map(mode -> {
            var list = byMode.getOrDefault(mode.getId(), List.of());
            var published = newestPublished(list);
            var draft = list.stream().filter(r -> r.getState() == RevisionState.DRAFT).findFirst()
                    .orElse(null);
            var shown = draft != null ? draft : published;
            var content = shown == null ? null : shown.getContent();
            var guideList = guides.getOrDefault(mode.getId(), List.of());
            var guidePublished = guideList.stream().filter(r -> r.getState() == RevisionState.PUBLISHED)
                    .max(Comparator.comparingLong(RevisionRecord::getRevisionNo)).orElse(null);
            var guideDraft = guideList.stream().filter(r -> r.getState() == RevisionState.DRAFT).findFirst()
                    .orElse(null);
            return new AdminSummary(mode.getId(), mode.getCode(), content == null ? mode.getCode() : content.name(),
                    content == null ? null : content.group(), content == null ? null : content.order(),
                    content == null ? "NONE" : content.guideKind(),
                    content == null || content.artAssetId() == null ? null : art.get(content.artAssetId()),
                    Revision.of(published), Revision.of(draft),
                    guideList.isEmpty()
                            ? null
                            : new GuideState(Revision.of(guidePublished),
                                    Revision.of(guideDraft)));
        }).sorted(Comparator.comparing((AdminSummary s) -> s.group() == null ? "~" : s.group())
                .thenComparing(s -> s.order() == null ? Integer.MAX_VALUE : s.order())
                .thenComparing(AdminSummary::code)).toList();
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminMode create(CreateMode input) {
        if (modes.findByCode(input.code()).isPresent())
            throw new ApiException(GameModeErrorCode.GAME_MODE_CODE_TAKEN, "The code is already in use.");
        var content = input.content() == null
                ? GameModeContent.initial(input.name(), input.group())
                : input.content();
        workflow.rejectInvalid(GameModeContentRules.validate(content));

        var actor = workflow.actor();
        var mode = new GameMode();
        mode.setId(UUID.randomUUID());
        mode.setCode(input.code());
        mode.setCreatedAt(workflow.now());
        mode.setCreatedByIssuer(actor.issuer());
        mode.setCreatedBySubject(actor.subject());
        modes.saveAndFlush(mode);
        var draft = newRevision(mode, content, null, null);
        workflow.record("GAME_MODE_CREATED", AGGREGATE, mode.getId(), draft, null, null);

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public AdminMode current(UUID id) {
        var mode = requireMode(id);
        var revision = revisions.findByModeIdAndState(id, RevisionState.DRAFT)
                .or(() -> revisions.findFirstByModeIdAndStateOrderByRevisionNoDesc(id, RevisionState.PUBLISHED))
                .orElseThrow(() -> new ApiException(GameModeErrorCode.GAME_MODE_REVISION_NOT_FOUND,
                        "The mode has no open draft or published revision."));
        return adminView(mode, revision);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Revision> history(UUID id) {
        requireMode(id);
        return revisions.findByModeIdOrderByRevisionNoDesc(id).stream().map(Revision::of).toList();
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public AdminMode revision(UUID id, UUID revisionId) {
        return adminView(requireMode(id), requireRevision(id, revisionId));
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminMode createDraft(UUID id, CreateDraft input) {
        var mode = lock(id);
        var open = revisions.findByModeIdAndState(id, RevisionState.DRAFT);
        workflow.requireNoOpenDraft(open.isPresent(), open.map(GameModeRevision::getId).orElse(null));
        var source = revisions.findFirstByModeIdAndStateOrderByRevisionNoDesc(id, RevisionState.PUBLISHED)
                .or(() -> revisions.findByModeIdOrderByRevisionNoDesc(id).stream().findFirst())
                .orElse(null);

        var content = source == null ? GameModeContent.initial(mode.getCode(), null) : source.getContent();
        var draft = newRevision(mode, content,
                source != null && source.getState() == RevisionState.PUBLISHED ? source.getId() : null,
                input.changeNote());
        workflow.record("GAME_MODE_DRAFT_CREATED", AGGREGATE, id, draft, null, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminMode update(UUID id, UUID revisionId, UpdateMode input) {
        var mode = lock(id);
        var draft = workflow.requireEditableDraft(requireRevision(id, revisionId), input.expectedVersion());
        workflow.rejectInvalid(GameModeContentRules.validate(input.content()));
        if (draft.getContent().equals(input.content()))
            return adminView(mode, draft);

        long before = draft.getVersion();
        draft.setContent(input.content());
        workflow.advance(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("GAME_MODE_DRAFT_UPDATED", AGGREGATE, id, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:publish')")
    public AdminMode publish(UUID id, UUID revisionId, Mutation input) {
        var mode = lock(id);
        var draft = workflow.requireEditableDraft(requireRevision(id, revisionId), input.expectedVersion());
        var content = draft.getContent();
        workflow.rejectInvalid(GameModeContentRules.validate(content));
        workflow.rejectIncomplete(GameModeContentRules.missingFields(content));
        images.requirePublishable(expectedImages(content));

        long before = draft.getVersion();
        workflow.publish(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("GAME_MODE_PUBLISHED", AGGREGATE, id, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @PreAuthorize("hasAuthority('gamemode:write')")
    public AdminMode discard(UUID id, UUID revisionId, Mutation input) {
        var mode = lock(id);
        var draft = workflow.requireEditableDraft(requireRevision(id, revisionId), input.expectedVersion());

        long before = draft.getVersion();
        workflow.discard(draft, input.changeNote());
        revisions.saveAndFlush(draft);
        workflow.record("GAME_MODE_DRAFT_DISCARDED", AGGREGATE, id, draft, before, input.changeNote());

        return adminView(mode, draft);
    }

    @Transactional(readOnly = true)
    public CardList cards() {
        var published = revisions.latestPublished();
        var byId = modes.findAllById(published.stream().map(GameModeRevision::getModeId).toList()).stream()
                .collect(Collectors.toMap(GameMode::getId, Function.identity()));
        var guides = new HashSet<>(guideRevisions.publishedModeIds(byId.keySet()));
        var art = images.hydrate(published.stream().map(r -> r.getContent().artAssetId())
                .filter(java.util.Objects::nonNull).toList());

        var cards = published.stream().map(revision -> {
            var content = revision.getContent();
            var mode = byId.get(revision.getModeId());
            return new Card(mode.getCode(), content.name(), content.group(), content.order(), content.summary(),
                    content.playersLabel(), content.duration(), content.availability(), content.guideKind(),
                    hasGuide(content, guides.contains(mode.getId())),
                    content.artAssetId() == null ? null : art.get(content.artAssetId()), revision.getPublishedAt());
        }).sorted(Comparator.comparing((Card card) -> "PVP".equals(card.group()) ? 0 : 1)
                .thenComparing(card -> card.order() == null ? Integer.MAX_VALUE : card.order())
                .thenComparing(Card::name)).toList();
        return new CardList(cards);
    }

    @Transactional(readOnly = true)
    public PublicMode published(String code) {
        var mode = requireModeByCode(code);
        var revision = latestPublished(mode.getId()).orElseThrow(GameModeCatalog::notFound);
        var content = revision.getContent();
        boolean guide = !guideRevisions.publishedModeIds(List.of(mode.getId())).isEmpty();
        return new PublicMode(mode.getCode(), GameModeViews.CONTENT_LOCALE,
                revision.getPublishedAt(), hasGuide(content, guide), content,
                images.hydrate(GameModeContentRules.assets(content)));
    }

    /** For the guide and lineup services of this module. */
    public GameMode requireMode(UUID id) {
        return modes.findById(id).orElseThrow(GameModeCatalog::notFound);
    }

    public GameMode requireModeByCode(String code) {
        return modes.findByCode(code).orElseThrow(GameModeCatalog::notFound);
    }

    public GameMode lock(UUID id) {
        return modes.lockById(id).orElseThrow(GameModeCatalog::notFound);
    }

    public Optional<GameModeRevision> latestPublished(UUID modeId) {
        return revisions.findFirstByModeIdAndStateOrderByRevisionNoDesc(modeId, RevisionState.PUBLISHED);
    }

    /** The content editors are working on: the open draft, else the published revision. */
    public Optional<GameModeContent> workingContent(UUID modeId) {
        return revisions.findByModeIdAndState(modeId, RevisionState.DRAFT)
                .or(() -> latestPublished(modeId)).map(GameModeRevision::getContent);
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
            if (content.artAssetId() != null)
                usages.computeIfAbsent(content.artAssetId(), key -> new ArrayList<>())
                        .add(new MediaUsage("GAMEMODE", "GAME_MODE", revision.getModeId(), revision.getId(), "ART",
                                scope).named(content.name(), null));
            for (var item : content.specialItems()) {
                if (item.iconAssetId() != null)
                    usages.computeIfAbsent(item.iconAssetId(), key -> new ArrayList<>())
                            .add(new MediaUsage("GAMEMODE", "GAME_MODE", revision.getModeId(), revision.getId(),
                                    "SPECIAL_ITEM_ICON", scope).named(content.name(), item.name()));
            }
        }
        return usages;
    }

    private static boolean hasGuide(GameModeContent content, boolean guidePublished) {
        return guidePublished && "AUTO_CHESS".equals(content.guideKind());
    }

    private Map<UUID, Set<MediaSemanticType>> expectedImages(GameModeContent content) {
        var expected = new HashMap<UUID, Set<MediaSemanticType>>();
        if (content.artAssetId() != null)
            expected.put(content.artAssetId(), GameModeImages.MODE_ART);
        content.specialItems().forEach(item -> {
            if (item.iconAssetId() != null)
                expected.put(item.iconAssetId(), GameModeImages.ICONS);
        });
        return expected;
    }

    private GameModeRevision newRevision(GameMode mode, GameModeContent content, UUID sourceId, String note) {
        var actor = workflow.actor();
        var now = workflow.now();
        var revision = new GameModeRevision();
        revision.setId(UUID.randomUUID());
        revision.setModeId(mode.getId());
        revision.setRevisionNo(revisions.maxRevisionNo(mode.getId()) + 1);
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

    private GameModeRevision requireRevision(UUID id, UUID revisionId) {
        return revisions.findByIdAndModeId(revisionId, id).orElseThrow(
                () -> new ApiException(GameModeErrorCode.GAME_MODE_REVISION_NOT_FOUND, "The revision was not found."));
    }

    private AdminMode adminView(GameMode mode, GameModeRevision revision) {
        var content = revision.getContent();
        boolean published = latestPublished(mode.getId()).isPresent();
        return new AdminMode(mode.getId(), mode.getCode(), Revision.of(revision), published, content,
                GameModeContentRules.missingFields(content), images.hydrate(GameModeContentRules.assets(content)));
    }

    private static GameModeRevision latest(List<GameModeRevision> revisions) {
        return revisions.stream().max(Comparator.comparingLong(GameModeRevision::getRevisionNo)).orElse(null);
    }

    private static GameModeRevision newestPublished(List<GameModeRevision> revisions) {
        return revisions.stream().filter(r -> r.getState() == RevisionState.PUBLISHED)
                .max(Comparator.comparingLong(GameModeRevision::getRevisionNo)).orElse(null);
    }

    private static ApiException notFound() {
        return new ApiException(GameModeErrorCode.GAME_MODE_NOT_FOUND, "The game mode was not found.");
    }
}
