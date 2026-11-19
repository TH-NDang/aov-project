package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.internal.application.response.PublicationOverviewView.ReleaseView;
import com.wikiaov.patch.internal.application.response.PublicationOverviewView.VariantView;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchRepository;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchTranslationRepository;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatch;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatchTranslation;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.domain.PatchDataReviewState;
import com.wikiaov.patch.internal.domain.PatchReleaseStatus;
import com.wikiaov.patch.internal.domain.PatchStatus;
import com.wikiaov.patch.internal.domain.PatchVariantStatus;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseRepository;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.review.persistence.PatchDataReviewRepository;
import com.wikiaov.patch.internal.review.persistence.entity.PatchDataReview;
import com.wikiaov.platform.CatalogLocales;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Renders the patch editorial state and release lifecycle from one loaded timeline. */
@Component
class PatchPublicationOverview {
    private final PatchDataReviewRepository reviews;
    private final PatchReleaseRepository releases;
    private final PatchVariantRepository variants;
    private final GamePatchRepository patches;
    private final GamePatchTranslationRepository texts;

    PatchPublicationOverview(PatchDataReviewRepository reviews, PatchReleaseRepository releases,
            PatchVariantRepository variants, GamePatchRepository patches, GamePatchTranslationRepository texts) {
        this.reviews = reviews;
        this.releases = releases;
        this.variants = variants;
        this.patches = patches;
        this.texts = texts;
    }

    record Timeline(
            List<PatchRelease> releases,
            List<PatchVariant> variants,
            Map<UUID, PatchVariant> variantsById,
            Map<UUID, GamePatch> patchesById,
            Map<UUID, PatchDataReview> reviewsById,
            Map<UUID, String> titlesByPatch
    ) {
    }

    Map<UUID, PatchDataReview> readReviews() {
        return reviews.findAll().stream()
                .collect(Collectors.toMap(PatchDataReview::getPatchVariantId, Function.identity()));
    }

    Timeline readTimeline(Map<UUID, PatchDataReview> reviewsById) {
        var allReleases = releases.findAll();
        var allVariants = variants.findAll();
        var variantsById = allVariants.stream().collect(Collectors.toMap(PatchVariant::getId, Function.identity()));
        var patchesById = patches.findAll().stream().collect(Collectors.toMap(GamePatch::getId, Function.identity()));
        return new Timeline(allReleases, allVariants, variantsById, patchesById, reviewsById, titles());
    }

    /** Admin edits in Vietnamese, the product's language, so it reads titles as a reader of that locale would. */
    private Map<UUID, String> titles() {
        return texts.findAll().stream()
                .sorted(CatalogLocales.preference(CatalogLocales.DEFAULT, GamePatchTranslation::getLocale))
                .collect(Collectors.toMap(GamePatchTranslation::getPatchId, GamePatchTranslation::getTitle,
                        (first, ignored) -> first));
    }

    List<VariantView> variants(Timeline timeline) {
        return timeline.variants().stream()
                .sorted(Comparator.comparingLong(PatchVariant::getRulesetOrdinal).reversed())
                .map(variant -> variantView(variant, timeline)).toList();
    }

    List<ReleaseView> releases(Timeline timeline, Set<UUID> currentReleaseIds, Instant now) {
        return timeline.releases().stream().sorted(Comparator.comparing(PatchRelease::getCreatedAt).reversed())
                .map(release -> releaseView(release, timeline, currentReleaseIds, now)).toList();
    }

    private static VariantView variantView(PatchVariant variant, Timeline timeline) {
        var review = timeline.reviewsById().get(variant.getId());
        return new VariantView(variant.getId(), variant.getPatchId(),
                timeline.patchesById().get(variant.getPatchId()).getCode(),
                timeline.titlesByPatch().get(variant.getPatchId()), variant.getRulesetId(),
                variant.getRulesetOrdinal(), variant.getSeasonId(), variant.getStatus(),
                review == null ? PatchDataReviewState.IN_PROGRESS : review.getState(),
                review == null ? 0L : review.getVersion(),
                review == null ? null : review.getCompletedAt());
    }

    private static ReleaseView releaseView(PatchRelease release, Timeline timeline, Set<UUID> currentReleaseIds,
            Instant now) {
        var variant = timeline.variantsById().get(release.getPatchVariantId());
        var patch = timeline.patchesById().get(variant.getPatchId());
        return new ReleaseView(release.getId(), release.getPatchVariantId(), release.getRegionId(),
                release.getSeasonId(), release.getEffectiveOn() == null ? release.getEffectiveAt() : null,
                release.getEffectiveOn(), release.getConfirmedAt(), release.getSourceUrl(), release.getStatus(),
                phase(release, variant, patch, currentReleaseIds, now));
    }

    private static String phase(PatchRelease release, PatchVariant variant, GamePatch patch,
            Set<UUID> currentReleaseIds, Instant now) {
        if (release.getEffectiveOn() != null && release.getStatus() == PatchReleaseStatus.DRAFT) {
            return "AWAITING_CONFIRMATION";
        }
        if (release.getStatus() != PatchReleaseStatus.SCHEDULED) {
            return release.getStatus().name();
        }
        if (variant.getStatus() != PatchVariantStatus.PUBLISHED || patch.getStatus() != PatchStatus.PUBLISHED) {
            return "DRAFT";
        }
        if (release.getEffectiveAt().isAfter(now)) {
            return "UPCOMING";
        }
        return currentReleaseIds.contains(release.getId()) ? "CURRENT" : "PAST";
    }
}
