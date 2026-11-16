package com.wikiaov.hero.internal.ranking.application;

import com.wikiaov.hero.internal.ranking.persistence.RankingSnapshotImageRepository;
import com.wikiaov.media.SourceFileUsage;
import com.wikiaov.media.SourceFileUsageProvider;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells media which stored screenshots ranking snapshots keep as evidence (ADR-030 section 7). */
@Component
class RankingSnapshotEvidence implements SourceFileUsageProvider {

    private final RankingSnapshotImageRepository images;

    RankingSnapshotEvidence(RankingSnapshotImageRepository images) {
        this.images = images;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SourceFileUsage> findUsages(String sha256) {
        return images.findUsesOfImage(sha256).stream()
                .map(use -> new SourceFileUsage("HERO", "RANKING_SNAPSHOT", use.getSnapshotId(), use.getCode(),
                        "SNAPSHOT_IMAGE"))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> findReferenced(Collection<String> sha256s) {
        return sha256s.isEmpty() ? Set.of() : Set.copyOf(images.findReferencedImageIds(sha256s));
    }
}
