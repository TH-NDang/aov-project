package com.wikiaov.video.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.application.SubjectVideos;
import com.wikiaov.video.internal.application.SubjectVideos.*;
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
import org.springframework.web.bind.annotation.*;

@RestController
@Validated
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/videos")
public class VideoAdminController implements VideoAdminApi {
    private final SubjectVideos videos;

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

    @GetMapping(path = "/subjects", version = "1")
    public SubjectList subjects(@RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return videos.subjects(locale);
    }

    @PostMapping(version = "1")
    public ResponseEntity<AdminVideo> create(@RequestBody SaveVideo input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(videos.create(input));
    }

    @PutMapping(path = "/{id}", version = "1")
    public AdminVideo update(@PathVariable UUID id, @RequestBody SaveVideo input) {
        return videos.update(id, input);
    }

    @DeleteMapping(path = "/{id}", version = "1")
    public ResponseEntity<Void> delete(@PathVariable UUID id, @RequestParam long expectedVersion) {
        videos.delete(id, expectedVersion);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/import", version = "1")
    public ImportResult importVideos(@RequestBody ImportVideos input) {
        return videos.importVideos(input);
    }
}
