package com.wikiaov.video.internal.persistence;

import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.domain.VideoStatus;
import com.wikiaov.video.internal.persistence.entity.SubjectVideo;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface SubjectVideoRepository
        extends
            JpaRepository<SubjectVideo, UUID>,
            JpaSpecificationExecutor<SubjectVideo> {

    List<SubjectVideo> findBySubjectIdAndStatusAndSubjectKindInOrderByDisplayOrderAscPublishedOnDescIdAsc(
            UUID subjectId,
            VideoStatus status, Collection<VideoSubjectKind> kinds, Limit limit);

    List<SubjectVideo> findBySubjectIdAndStatusAndSubjectKindAndSubjectKeyOrderByDisplayOrderAscPublishedOnDescIdAsc(
            UUID subjectId, VideoStatus status, VideoSubjectKind kind, String subjectKey, Limit limit);

    boolean existsBySubjectKindAndSubjectIdAndSubjectKeyAndUrlAndStartSeconds(VideoSubjectKind kind, UUID subjectId,
            String subjectKey, String url, int startSeconds);

    Optional<SubjectVideo> findFirstBySubjectKindAndSubjectIdAndSubjectKeyOrderByDisplayOrderDesc(VideoSubjectKind kind,
            UUID subjectId, String subjectKey);

    List<SubjectVideo> findBySubjectIdIn(Collection<UUID> subjectIds);

    /**
     * A patch's own videos and the change videos that name it, oldest first, so a reader sees what came before and after
     * the release. Videos without a date come last.
     */
    @Query("""
            select v from SubjectVideo v
            where v.patchVariantId=:variantId and v.status=:status
                and (v.subjectKind=com.wikiaov.video.VideoSubjectKind.PATCH
                    or v.purpose=com.wikiaov.video.internal.domain.VideoPurpose.PATCH_CHANGE)
            order by v.publishedOn asc nulls last,v.publishedAt asc nulls last,v.displayOrder,v.id
            """)
    List<SubjectVideo> patchVideos(UUID variantId, VideoStatus status, Limit limit);
}
