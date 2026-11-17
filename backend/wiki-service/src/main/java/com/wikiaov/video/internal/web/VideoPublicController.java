package com.wikiaov.video.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.application.SubjectVideos;
import com.wikiaov.video.internal.application.VideoViews.PublicVideoList;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ROOT + "/videos")
public class VideoPublicController implements VideoPublicApi {
    private final SubjectVideos videos;

    @GetMapping(version = "1")
    public ResponseEntity<PublicVideoList> list(@RequestParam VideoSubjectKind subjectKind,
            @RequestParam UUID subjectId, @RequestParam(required = false) String subjectKey,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("subjectKind", "subjectId", "subjectKey"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(videos.published(subjectKind, subjectId, subjectKey));
    }
}
