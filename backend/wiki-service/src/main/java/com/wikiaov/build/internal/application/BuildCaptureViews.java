package com.wikiaov.build.internal.application;

import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.internal.application.response.BuildViews;
import com.wikiaov.build.internal.application.response.BuildViews.Detail;
import com.wikiaov.build.internal.application.response.BuildViews.Summary;
import com.wikiaov.build.internal.persistence.BuildRepository;
import com.wikiaov.build.internal.persistence.CaptureHeroRepository;
import com.wikiaov.build.internal.persistence.CaptureImageRepository;
import com.wikiaov.build.internal.persistence.entity.BuildRow;
import com.wikiaov.build.internal.persistence.entity.CaptureHeroRow;
import com.wikiaov.build.internal.persistence.entity.CaptureRow;
import com.wikiaov.patch.GameplayContexts;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** What the admin sees of a build capture: its summary with counts, and its detail with images, heroes and builds. */
@Component
class BuildCaptureViews {
    private final CaptureImageRepository images;
    private final CaptureHeroRepository heroes;
    private final BuildRepository builds;
    private final BuildReadModel readModel;
    private final BuildReferences references;
    private final GameplayContexts contexts;

    BuildCaptureViews(CaptureImageRepository images, CaptureHeroRepository heroes, BuildRepository builds,
            BuildReadModel readModel, BuildReferences references, GameplayContexts contexts) {
        this.images = images;
        this.heroes = heroes;
        this.builds = builds;
        this.readModel = readModel;
        this.references = references;
        this.contexts = contexts;
    }

    Detail detailOf(CaptureRow capture) {
        var imageRows = images.findByCaptureIdOrderByFileNameAsc(capture.getId());
        var heroRows = heroes.findByCaptureIdOrderByCaptureOrderAsc(capture.getId());
        var buildRows = builds.findByCaptureId(capture.getId());

        var loaded = readModel.load(buildRows);
        var heroRefs = references.byIds(BuildReferenceKind.HERO,
                heroRows.stream().map(CaptureHeroRow::getHeroId).toList());
        Map<UUID, List<BuildRow>> byHero = buildRows.stream().collect(Collectors.groupingBy(BuildRow::getHeroId));
        var heroViews = heroRows.stream().map(row -> new BuildViews.HeroEntry(row.getHeroId(),
                Optional.ofNullable(heroRefs.get(row.getHeroId())).map(BuildReference::code).orElse(null),
                row.getNameOnScreen(), row.getCaptureOrder(), row.getResult(),
                byHero.getOrDefault(row.getHeroId(), List.of()).stream()
                        .sorted(Comparator.comparingInt(BuildRow::getListPosition)).map(loaded::view).toList()))
                .toList();
        int open = (int) buildRows.stream().filter(BuildRow::isNeedsReview).count();

        return new Detail(capture.getId(), capture.getCode(), capture.getRegionCode(), capture.getSourceKind(),
                capture.getSourceLabel(), capture.getCapturedAt(), capture.getSourceTimeZone(),
                capture.getPatchVariantId(), patchCode(capture), capture.getConfirmedAt(), heroRows.size(),
                buildRows.size(), open, capture.getVersion(), capture.getSourceRun(), capture.getSourceNote(),
                capture.getCreatedAt(),
                imageRows.stream().map(row -> new BuildViews.Image(row.getImageId(), row.getFileName(),
                        row.getWidth(), row.getHeight(), row.getLayout())).toList(),
                heroViews);
    }

    Summary summaryOf(CaptureRow capture) {
        return summary(capture, counts(List.of(capture.getId())).get(capture.getId()));
    }

    Summary summary(CaptureRow row, int[] count) {
        int[] safe = count == null ? new int[3] : count;
        return new Summary(row.getId(), row.getCode(), row.getRegionCode(), row.getSourceKind(), row.getSourceLabel(),
                row.getCapturedAt(), row.getSourceTimeZone(), row.getPatchVariantId(), patchCode(row),
                row.getConfirmedAt(), safe[0], safe[1], safe[2], row.getVersion());
    }

    String patchCode(CaptureRow row) {
        return row.getPatchVariantId() == null ? null : contexts.patchCode(row.getPatchVariantId());
    }

    /** Heroes, builds and builds waiting for review, per capture. */
    Map<UUID, int[]> counts(Collection<UUID> captureIds) {
        Map<UUID, int[]> counts = new HashMap<>();
        if (captureIds.isEmpty()) {
            return counts;
        }
        heroes.countByCapture(captureIds).forEach(row -> counts
                .computeIfAbsent(row.getCaptureId(), id -> new int[3])[0] = (int) row.getTotal());
        builds.countByCapture(captureIds).forEach(row -> {
            var count = counts.computeIfAbsent(row.getCaptureId(), id -> new int[3]);
            count[1] = (int) row.getTotal();
            count[2] = (int) row.getNeedsReview();
        });
        return counts;
    }
}
