package com.wikiaov.build.internal.application;

import com.wikiaov.build.internal.persistence.CaptureImageRepository;
import com.wikiaov.media.SourceFileUsage;
import com.wikiaov.media.SourceFileUsageProvider;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Tells media which stored screenshots build captures keep as evidence (ADR-030 section 7). */
@Component
class BuildCaptureEvidence implements SourceFileUsageProvider {

    private final CaptureImageRepository images;

    BuildCaptureEvidence(CaptureImageRepository images) {
        this.images = images;
    }

    @Override
    @Transactional(readOnly = true)
    public List<SourceFileUsage> findUsages(String sha256) {
        return images.findUsesOfImage(sha256).stream()
                .map(use -> new SourceFileUsage("BUILD", "BUILD_CAPTURE", use.getCaptureId(), use.getCode(),
                        "CAPTURE_IMAGE"))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> findReferenced(Collection<String> sha256s) {
        return sha256s.isEmpty() ? Set.of() : Set.copyOf(images.findReferencedImageIds(sha256s));
    }
}
