package com.wikiaov.video.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.application.SubjectVideos;
import com.wikiaov.video.internal.application.VideoCommands.AdminFilter;
import com.wikiaov.video.internal.application.VideoCommands.ImportVideos;
import com.wikiaov.video.internal.application.VideoCommands.SaveVideo;
import com.wikiaov.video.internal.application.VideoViews.AdminVideo;
import com.wikiaov.video.internal.application.VideoViews.ImportResult;
import com.wikiaov.video.internal.application.VideoViews.SubjectList;
import com.wikiaov.video.internal.domain.VideoOrigin;
import com.wikiaov.video.internal.domain.VideoPurpose;
import com.wikiaov.video.internal.domain.VideoStatus;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/videos")
public class VideoAdminController implements VideoAdminApi {
    private final SubjectVideos videos;

    @Override
    @GetMapping(version = "1")
    public PageSlice<AdminVideo> list(@RequestParam(required = false) VideoSubjectKind subjectKind,
            @RequestParam(required = false) UUID subjectId, @RequestParam(required = false) String subjectKey,
            @RequestParam(required = false) VideoStatus status, @RequestParam(required = false) VideoPurpose purpose,
            @RequestParam(required = false) VideoOrigin origin, @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("subjectKind", "subjectId", "subjectKey", "status", "purpose", "origin", "q", "page", "size"));
        return videos.list(new AdminFilter(subjectKind, subjectId, subjectKey, status, purpose, origin, q), page, size);
    }

    @Override
    @GetMapping(path = "/subjects", version = "1")
    public SubjectList subjects(@RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return videos.subjects(locale);
    }

    @Override
    @PostMapping(version = "1")
    public ResponseEntity<AdminVideo> create(@RequestBody SaveVideo input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(videos.create(input));
    }

    @Override
    @PutMapping(path = "/{id}", version = "1")
    public AdminVideo update(@PathVariable UUID id, @RequestBody SaveVideo input) {
        return videos.update(id, input);
    }

    @Override
    @DeleteMapping(path = "/{id}", version = "1")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestParam long expectedVersion) {
        videos.delete(id, expectedVersion);
        return ResponseEntity.noContent().build();
    }

    @Override
    @PostMapping(path = "/import", version = "1")
    public ImportResult importVideos(@RequestBody ImportVideos input) {
        return videos.importVideos(input);
    }
}
