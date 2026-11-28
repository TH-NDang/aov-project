package com.wikiaov.video.internal.persistence;

import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.domain.VideoOrigin;
import com.wikiaov.video.internal.domain.VideoPurpose;
import com.wikiaov.video.internal.domain.VideoStatus;
import com.wikiaov.video.internal.persistence.entity.SubjectVideo;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.jpa.domain.Specification;

public final class SubjectVideoSpecifications {

    private SubjectVideoSpecifications() {
    }

    public static Specification<SubjectVideo> matching(Collection<VideoSubjectKind> kinds, UUID subjectId,
            String subjectKey, VideoStatus status, VideoPurpose purpose, VideoOrigin origin, String q,
            UUID patchVariantId) {
        return (root, query, builder) -> {
            var filters = new ArrayList<Predicate>();
            if (!kinds.isEmpty()) {
                filters.add(root.get("subjectKind").in(kinds));
            }
            if (subjectId != null) {
                filters.add(builder.equal(root.get("subjectId"), subjectId));
            }
            if (subjectKey != null) {
                filters.add(builder.equal(root.get("subjectKey"), subjectKey));
            }
            if (patchVariantId != null) {
                filters.add(builder.equal(root.get("patchVariantId"), patchVariantId));
            }
            if (status != null) {
                filters.add(builder.equal(root.get("status"), status));
            }
            if (purpose != null) {
                filters.add(builder.equal(root.get("purpose"), purpose));
            }
            if (origin != null) {
                filters.add(builder.equal(root.get("origin"), origin));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.strip().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%")
                        .replace("_", "\\_") + "%";
                filters.add(builder.or(builder.like(builder.lower(root.get("title")), pattern, '\\'),
                        builder.like(builder.lower(root.get("url")), pattern, '\\')));
            }
            return builder.and(filters.toArray(Predicate[]::new));
        };
    }
}
