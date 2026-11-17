package com.wikiaov.build.internal.application;

import static com.wikiaov.build.internal.application.BuildCaptureRules.blankToNull;
import static com.wikiaov.build.internal.application.BuildCaptureRules.invalid;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.internal.application.BuildCommands.ConfirmCapture;
import com.wikiaov.build.internal.application.BuildCommands.ImportCapture;
import com.wikiaov.build.internal.application.BuildCommands.ImportedBuild;
import com.wikiaov.build.internal.application.BuildCommands.ReviewBuild;
import com.wikiaov.build.internal.application.response.BuildViews;
import com.wikiaov.build.internal.application.response.BuildViews.Detail;
import com.wikiaov.build.internal.application.response.BuildViews.Summary;
import com.wikiaov.build.internal.domain.BuildContent;
import com.wikiaov.build.internal.domain.BuildRules;
import com.wikiaov.build.internal.domain.BuildRules.ArcanaPart;
import com.wikiaov.build.internal.domain.BuildRules.EnchantmentPart;
import com.wikiaov.build.internal.domain.BuildRules.ItemPart;
import com.wikiaov.build.internal.persistence.BuildItemRepository;
import com.wikiaov.build.internal.persistence.BuildRepository;
import com.wikiaov.build.internal.persistence.CaptureHeroRepository;
import com.wikiaov.build.internal.persistence.CaptureImageRepository;
import com.wikiaov.build.internal.persistence.CaptureRepository;
import com.wikiaov.build.internal.persistence.entity.BuildItemRow;
import com.wikiaov.build.internal.persistence.entity.BuildRow;
import com.wikiaov.build.internal.persistence.entity.CaptureHeroRow;
import com.wikiaov.build.internal.persistence.entity.CaptureImageRow;
import com.wikiaov.build.internal.persistence.entity.CaptureRow;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Captures of the game's recommended builds read from screenshots (ADR-026): import, correction or review of one build,
 * sign-off of a whole capture and removal of one imported by mistake. Writes lock the capture row so its count of builds
 * waiting for review cannot move under a confirmation.
 */
@Service
public class BuildCaptures {
    private static final Sort LIST_ORDER = Sort.by(Sort.Order.desc("capturedAt"), Sort.Order.asc("id"));
    private static final String AGGREGATE = "BUILD_CAPTURE";

    private final CaptureRepository captures;
    private final CaptureImageRepository images;
    private final CaptureHeroRepository heroes;
    private final BuildRepository builds;
    private final BuildItemRepository buildItems;
    private final BuildValues values;
    private final BuildReadModel readModel;
    private final BuildReferences references;
    private final BuildCaptureViews views;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public BuildCaptures(CaptureRepository captures, CaptureImageRepository images, CaptureHeroRepository heroes,
            BuildRepository builds, BuildItemRepository buildItems, BuildValues values, BuildReadModel readModel,
            BuildReferences references, BuildCaptureViews views, GameplayContexts contexts, CurrentActor actors,
            AuditLog audit, Clock clock) {
        this.captures = captures;
        this.images = images;
        this.heroes = heroes;
        this.builds = builds;
        this.buildItems = buildItems;
        this.values = values;
        this.readModel = readModel;
        this.references = references;
        this.views = views;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<Summary> list(String region, String source, int page, int size) {
        var result = captures.findAll(CaptureRepository.matching(region, source),
                PageRequest.of(page, size, LIST_ORDER));
        var counts = views.counts(result.getContent().stream().map(CaptureRow::getId).toList());

        return new PageSlice<>(
                result.getContent().stream().map(row -> views.summary(row, counts.get(row.getId()))).toList(),
                page, size, result.getTotalElements());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public Detail detail(UUID captureId) {
        return views.detailOf(captures.findById(captureId).orElseThrow(BuildCaptures::captureNotFound));
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public Detail importCapture(ImportCapture request) {
        BuildCaptureRules.validateCapture(request);
        var imageIds = BuildCaptureRules.validateImages(request.images());
        BuildCaptureRules.validateHeroes(request, imageIds);
        var resolved = resolve(request);
        var prepared = prepare(request, resolved);
        if (captures.existsByCode(request.code()))
            throw captureExists(request.code());

        var actor = actors.require();
        var now = clock.instant();
        var capture = new CaptureRow();
        capture.setId(UUID.randomUUID());
        capture.setCode(request.code());
        capture.setRegionCode(request.regionCode());
        capture.setSourceKind(request.sourceKind());
        capture.setSourceLabel(request.sourceLabel().trim());
        capture.setCapturedAt(request.capturedAt());
        capture.setSourceTimeZone(request.sourceTimeZone());
        capture.setSourceRun(request.sourceRun().trim());
        capture.setSourceNote(blankToNull(request.sourceNote()));
        capture.setPatchVariantId(patchAt(request.regionCode(), request.capturedAt()));
        capture.setVersion(1);
        capture.setCreatedAt(now);
        capture.setCreatedByIssuer(actor.issuer());
        capture.setCreatedBySubject(actor.subject());
        capture.setUpdatedAt(now);
        try {
            captures.saveAndFlush(capture);
        } catch (DataIntegrityViolationException e) {
            throw captureExists(request.code());
        }
        images.saveAllAndFlush(request.images().stream().map(image -> imageRow(capture.getId(), image)).toList());
        heroes.saveAllAndFlush(request.heroes().stream()
                .map(hero -> heroRow(capture.getId(), resolved.heroes().get(hero.heroCode()).id(), hero)).toList());
        insertBuilds(capture.getId(), prepared, now);

        var detail = views.detailOf(capture);
        audit.record(new AuditEntry(actor, "BUILD_CAPTURE_IMPORTED", AGGREGATE, capture.getId(), null, null, 1L, null,
                Map.of("code", capture.getCode(), "heroes", detail.heroCount(), "builds", detail.buildCount(),
                        "needsReview", detail.needsReviewCount())));
        return detail;
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public BuildViews.Reviewed review(UUID captureId, UUID buildId, ReviewBuild request) {
        var content = contentOf(request);
        boolean needsReview = request.needsReview();
        BuildCaptureRules.checkContent("This build", content, needsReview);

        var capture = captures.lockById(captureId).orElseThrow(BuildCaptures::captureNotFound);
        var row = builds.findByIdAndCaptureId(buildId, captureId)
                .orElseThrow(
                        () -> new ApiException(BuildErrorCode.BUILD_NOT_FOUND, "This build is not in the capture."));
        if (row.getVersion() != request.expectedVersion())
            throw versionConflict(row.getVersion());

        var actor = actors.require();
        var now = clock.instant();
        UUID oldPage = row.getArcanaPageId();
        UUID oldSet = row.getEnchantmentSetId();
        String oldKey = row.getContentKey();
        applyContent(row, content, new SharedValues(now));
        row.setPlayerName(blankToNull(request.playerName()));
        row.setPlayerPower(request.playerPower());
        row.setPlayerWinRate(request.playerWinRate());
        row.setNeedsReview(needsReview);
        row.setNote(blankToNull(request.note()));
        row.setReviewedAt(needsReview ? null : now);
        row.setReviewedByIssuer(needsReview ? null : actor.issuer());
        row.setReviewedBySubject(needsReview ? null : actor.subject());
        row.setVersion(row.getVersion() + 1);
        row.setUpdatedAt(now);
        replaceItems(row.getId(), content.items());
        if (needsReview && capture.getConfirmedAt() != null)
            reopen(capture, now);
        builds.flush();
        values.dropUnused(Collections.singletonList(oldPage), Collections.singletonList(oldSet));

        audit.record(new AuditEntry(actor, "BUILD_REVIEWED", AGGREGATE, captureId, null, row.getVersion() - 1,
                row.getVersion(), null, Map.of("buildId", buildId, "needsReview", needsReview, "changed",
                        !Objects.equals(oldKey, row.getContentKey()))));
        return new BuildViews.Reviewed(readModel.load(List.of(row)).view(row), views.summaryOf(capture));
    }

    @PreAuthorize("hasAuthority('hero:publish')")
    @Transactional
    public Summary confirm(UUID captureId, ConfirmCapture request) {
        var capture = captures.lockById(captureId).orElseThrow(BuildCaptures::captureNotFound);
        if (capture.getConfirmedAt() != null)
            return views.summaryOf(capture);
        if (capture.getVersion() != request.expectedVersion())
            throw versionConflict(capture.getVersion());
        long open = builds.countByCaptureIdAndNeedsReviewTrue(captureId);
        if (open > 0)
            throw new ApiException(BuildErrorCode.BUILD_REVIEW_OPEN, open + " builds still wait for review.",
                    Map.of("needsReview", open));

        var actor = actors.require();
        var now = clock.instant();
        capture.setConfirmedAt(now);
        capture.setConfirmedByIssuer(actor.issuer());
        capture.setConfirmedBySubject(actor.subject());
        capture.setVersion(capture.getVersion() + 1);
        capture.setUpdatedAt(now);
        captures.flush();

        audit.record(new AuditEntry(actor, "BUILD_CAPTURE_CONFIRMED", AGGREGATE, captureId, null,
                capture.getVersion() - 1, capture.getVersion(), null, Map.of("code", capture.getCode())));
        return views.summaryOf(capture);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public void delete(UUID captureId, long expectedVersion) {
        var capture = captures.lockById(captureId).orElseThrow(BuildCaptures::captureNotFound);
        if (capture.getVersion() != expectedVersion)
            throw versionConflict(capture.getVersion());

        var actor = actors.require();
        var rows = builds.findByCaptureId(captureId);
        var pageIds = rows.stream().map(BuildRow::getArcanaPageId).toList();
        var setIds = rows.stream().map(BuildRow::getEnchantmentSetId).toList();
        captures.delete(capture);
        captures.flush();
        values.dropUnused(pageIds, setIds);

        audit.record(new AuditEntry(actor, "BUILD_CAPTURE_DELETED", AGGREGATE, captureId, null, capture.getVersion(),
                null, null, Map.of("code", capture.getCode(), "builds", rows.size())));
    }

    /** Builds are written in two passes (builds, then their items) after each distinct shared value is resolved once. */
    private void insertBuilds(UUID captureId, List<Prepared> prepared, Instant now) {
        var shared = new SharedValues(now);
        List<BuildRow> rows = new ArrayList<>();
        List<BuildItemRow> items = new ArrayList<>();
        for (var entry : prepared) {
            var build = entry.build();
            var row = new BuildRow();
            row.setId(UUID.randomUUID());
            row.setCaptureId(captureId);
            row.setHeroId(entry.heroId());
            row.setListPosition(build.position());
            row.setPlayerName(blankToNull(build.playerName()));
            row.setPlayerPower(build.playerPower());
            row.setPlayerWinRate(build.playerWinRate());
            row.setImageId(blankToNull(build.imageId()));
            row.setNeedsReview(build.needsReview());
            row.setNote(blankToNull(build.note()));
            row.setVersion(1);
            row.setUpdatedAt(now);
            applyContent(row, entry.content(), shared);
            rows.add(row);
            items.addAll(itemRows(row.getId(), entry.content().items()));
        }

        builds.saveAllAndFlush(rows);
        buildItems.saveAllAndFlush(items);
    }

    /** Points the build at the shared values of its content; incomplete parts stay empty. */
    private static void applyContent(BuildRow row, BuildContent content, SharedValues shared) {
        row.setArcanaPageId(content.arcana().isEmpty() ? null : shared.page(content.arcana()));
        row.setEnchantmentSetId(content.enchantments().size() == BuildRules.ENCHANTMENT_SLOTS
                ? shared.set(content.enchantments())
                : null);
        row.setSpellId(content.spellId());
        row.setContentKey(content.contentKey());
    }

    /** Resolves each distinct arcana page and enchantment set once per request. */
    private final class SharedValues {
        private final Instant now;
        private final Map<String, UUID> pages = new HashMap<>();
        private final Map<String, UUID> sets = new HashMap<>();

        SharedValues(Instant now) {
            this.now = now;
        }

        UUID page(List<ArcanaPart> arcana) {
            return pages.computeIfAbsent(BuildRules.arcanaKey(arcana), key -> values.arcanaPage(arcana, now));
        }

        UUID set(List<EnchantmentPart> enchantments) {
            return sets.computeIfAbsent(BuildRules.enchantmentKey(enchantments),
                    key -> values.enchantmentSet(enchantments, now));
        }
    }

    private void replaceItems(UUID buildId, List<ItemPart> items) {
        buildItems.deleteAll(buildItems.findByBuildIdOrderBySlotAsc(buildId));
        buildItems.flush();
        buildItems.saveAllAndFlush(itemRows(buildId, items));
    }

    private static List<BuildItemRow> itemRows(UUID buildId, List<ItemPart> items) {
        return items.stream().map(item -> {
            var row = new BuildItemRow();
            row.setBuildId(buildId);
            row.setSlot(item.slot());
            row.setItemId(item.itemId());
            return row;
        }).toList();
    }

    private void reopen(CaptureRow capture, Instant now) {
        capture.setConfirmedAt(null);
        capture.setConfirmedByIssuer(null);
        capture.setConfirmedBySubject(null);
        capture.setVersion(capture.getVersion() + 1);
        capture.setUpdatedAt(now);
    }

    /** The patch in effect in the market when the capture was taken; null when the market has no known schedule. */
    private UUID patchAt(String region, Instant capturedAt) {
        return contexts.active(capturedAt).stream().filter(context -> context.regionCode().equals(region))
                .map(GameplayContext::patchVariantId).findFirst().orElse(null);
    }

    /** Every code the request uses, resolved by its owner; any unknown code rejects the import. */
    private Resolved resolve(ImportCapture request) {
        Set<String> heroCodes = new TreeSet<>(), itemCodes = new TreeSet<>(), enchantmentCodes = new TreeSet<>(),
                arcanaCodes = new TreeSet<>(), spellCodes = new TreeSet<>();
        for (var hero : request.heroes()) {
            heroCodes.add(hero.heroCode());
            for (var build : hero.builds()) {
                build.items().forEach(item -> itemCodes.add(item.code()));
                build.enchantments().forEach(enchantment -> enchantmentCodes.add(enchantment.code()));
                build.arcana().forEach(arcana -> arcanaCodes.add(arcana.code()));
                if (blankToNull(build.spell()) != null)
                    spellCodes.add(build.spell().trim());
            }
        }

        var resolved = new Resolved(references.byCodes(BuildReferenceKind.HERO, heroCodes),
                references.byCodes(BuildReferenceKind.ITEM, itemCodes),
                references.byCodes(BuildReferenceKind.ENCHANTMENT, enchantmentCodes),
                references.byCodes(BuildReferenceKind.ARCANA, arcanaCodes),
                references.byCodes(BuildReferenceKind.SPELL, spellCodes));
        Map<String, List<String>> unknown = new TreeMap<>();
        missing(BuildReferenceKind.HERO, heroCodes, resolved.heroes(), unknown);
        missing(BuildReferenceKind.ITEM, itemCodes, resolved.items(), unknown);
        missing(BuildReferenceKind.ENCHANTMENT, enchantmentCodes, resolved.enchantments(), unknown);
        missing(BuildReferenceKind.ARCANA, arcanaCodes, resolved.arcana(), unknown);
        missing(BuildReferenceKind.SPELL, spellCodes, resolved.spells(), unknown);
        if (!unknown.isEmpty())
            throw new ApiException(BuildErrorCode.BUILD_INVALID, "Unknown codes: " + unknown + ".",
                    Map.of("unknownCodes", unknown));

        Set<UUID> heroIds = new HashSet<>();
        for (var hero : request.heroes())
            if (!heroIds.add(resolved.heroes().get(hero.heroCode()).id()))
                throw invalid("Hero " + hero.heroCode() + " is listed twice under another code.");
        return resolved;
    }

    private static void missing(BuildReferenceKind kind, Set<String> wanted, Map<String, BuildReference> found,
            Map<String, List<String>> unknown) {
        var absent = wanted.stream().filter(code -> !found.containsKey(code)).toList();
        if (!absent.isEmpty())
            unknown.put(kind.name(), absent);
    }

    private static List<Prepared> prepare(ImportCapture request, Resolved resolved) {
        List<Prepared> prepared = new ArrayList<>();
        for (var hero : request.heroes())
            for (var build : hero.builds()) {
                var content = new BuildContent(
                        build.items().stream().map(item -> new ItemPart(item.slot(),
                                resolved.items().get(item.code()).id())).toList(),
                        build.enchantments().stream().map(enchantment -> enchantmentPart(enchantment.slot(),
                                resolved.enchantments().get(enchantment.code()))).toList(),
                        build.arcana().stream().map(arcana -> arcanaPart(resolved.arcana().get(arcana.code()),
                                arcana.quantity())).toList(),
                        blankToNull(build.spell()) == null ? null : resolved.spells().get(build.spell().trim()).id());
                BuildCaptureRules.checkContent(hero.heroCode() + " build " + build.position(), content,
                        build.needsReview());
                prepared.add(new Prepared(resolved.heroes().get(hero.heroCode()).id(), build, content));
            }
        return prepared;
    }

    /** The content of a review request, named by identifier; any unknown identifier rejects it. */
    private BuildContent contentOf(ReviewBuild request) {
        var itemRefs = references.byIds(BuildReferenceKind.ITEM,
                request.items().stream().map(BuildCommands.ItemSlot::itemId).toList());
        var enchantmentRefs = references.byIds(BuildReferenceKind.ENCHANTMENT,
                request.enchantments().stream().map(BuildCommands.EnchantmentSlot::enchantmentId).toList());
        var arcanaRefs = references.byIds(BuildReferenceKind.ARCANA,
                request.arcana().stream().map(BuildCommands.ArcanaQuantity::arcanaId).toList());
        var spellRefs = references.byIds(BuildReferenceKind.SPELL,
                request.spellId() == null ? List.of() : List.of(request.spellId()));

        Map<String, List<String>> unknown = new TreeMap<>();
        missingIds(BuildReferenceKind.ITEM, request.items().stream().map(BuildCommands.ItemSlot::itemId), itemRefs,
                unknown);
        missingIds(BuildReferenceKind.ENCHANTMENT,
                request.enchantments().stream().map(BuildCommands.EnchantmentSlot::enchantmentId), enchantmentRefs,
                unknown);
        missingIds(BuildReferenceKind.ARCANA, request.arcana().stream().map(BuildCommands.ArcanaQuantity::arcanaId),
                arcanaRefs, unknown);
        if (request.spellId() != null)
            missingIds(BuildReferenceKind.SPELL, Stream.of(request.spellId()), spellRefs, unknown);
        if (!unknown.isEmpty())
            throw new ApiException(BuildErrorCode.BUILD_INVALID, "Unknown identifiers: " + unknown + ".",
                    Map.of("unknownIds", unknown));

        return new BuildContent(
                request.items().stream().map(item -> new ItemPart(item.slot(), item.itemId()))
                        .toList(),
                request.enchantments().stream()
                        .map(enchantment -> enchantmentPart(enchantment.slot(),
                                enchantmentRefs.get(enchantment.enchantmentId())))
                        .toList(),
                request.arcana().stream().map(arcana -> arcanaPart(arcanaRefs.get(arcana.arcanaId()),
                        arcana.quantity())).toList(),
                request.spellId());
    }

    private static void missingIds(BuildReferenceKind kind, Stream<UUID> wanted,
            Map<UUID, BuildReference> found, Map<String, List<String>> unknown) {
        var absent = wanted.filter(id -> !found.containsKey(id)).map(UUID::toString).distinct().toList();
        if (!absent.isEmpty())
            unknown.put(kind.name(), absent);
    }

    private static EnchantmentPart enchantmentPart(int slot, BuildReference reference) {
        return new EnchantmentPart(slot, reference.id(), reference.branchCode(), reference.tier());
    }

    private static ArcanaPart arcanaPart(BuildReference reference, int quantity) {
        return new ArcanaPart(reference.id(), quantity, reference.color());
    }

    private static CaptureImageRow imageRow(UUID captureId, BuildCommands.Image image) {
        var row = new CaptureImageRow();
        row.setCaptureId(captureId);
        row.setImageId(image.imageId());
        row.setFileName(image.fileName().trim());
        row.setWidth(image.width());
        row.setHeight(image.height());
        row.setLayout(image.layout());
        return row;
    }

    private static CaptureHeroRow heroRow(UUID captureId, UUID heroId, BuildCommands.Hero hero) {
        var row = new CaptureHeroRow();
        row.setCaptureId(captureId);
        row.setHeroId(heroId);
        row.setNameOnScreen(hero.nameOnScreen().trim());
        row.setCaptureOrder(hero.captureOrder());
        row.setResult(hero.result());
        return row;
    }

    private record Resolved(
            Map<String, BuildReference> heroes,
            Map<String, BuildReference> items,
            Map<String, BuildReference> enchantments,
            Map<String, BuildReference> arcana,
            Map<String, BuildReference> spells
    ) {
    }

    private record Prepared(
            UUID heroId,
            ImportedBuild build,
            BuildContent content
    ) {
    }

    private static ApiException captureNotFound() {
        return new ApiException(BuildErrorCode.BUILD_CAPTURE_NOT_FOUND, "Build capture was not found.");
    }

    private static ApiException captureExists(String code) {
        return new ApiException(BuildErrorCode.BUILD_CAPTURE_EXISTS,
                "A build capture with code " + code + " already exists.");
    }

    private static ApiException versionConflict(long current) {
        return new ApiException(BuildErrorCode.BUILD_VERSION_CONFLICT, "Someone else changed this first.",
                Map.of("currentVersion", current));
    }

}
