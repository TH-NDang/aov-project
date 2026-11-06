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
}
