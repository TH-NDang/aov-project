package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.watch.application.PatchWatch;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.AddPatchNotePost;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.ChangePatchNoteSchedule;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.ChangePatchNoteState;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchNotePostView;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchNoteSourceView;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchWatchOverview;
import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
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
@RequestMapping(ApiPaths.ADMIN + "/patch-watch")
public class PatchWatchController implements PatchWatchApi {
    private final PatchWatch watch;

    public PatchWatchController(PatchWatch watch) {
        this.watch = watch;
    }

    @Override
    @GetMapping(version = "1")
    public PatchWatchOverview overview(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return watch.overview();
    }

    @Override
    @GetMapping(path = "/posts", version = "1")
    public PageSlice<PatchNotePostView> posts(@RequestParam(required = false) PatchNotePostState state,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "30") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("state", "page", "size"));
        return watch.posts(state, page, size);
    }

    @Override
    @PostMapping(path = "/posts", version = "1")
    public ResponseEntity<PatchNotePostView> add(@RequestBody AddPatchNotePost input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(watch.add(input));
    }

    @Override
    @PutMapping(path = "/posts/{id}/state", version = "1")
    public PatchNotePostView changeState(@PathVariable UUID id, @RequestBody ChangePatchNoteState input) {
        return watch.changeState(id, input);
    }

    @Override
    @PutMapping(path = "/sources/{code}/schedule", version = "1")
    public PatchNoteSourceView changeSchedule(@PathVariable PatchNoteSource code,
            @RequestBody ChangePatchNoteSchedule input) {
        return watch.changeSchedule(code, input);
    }

    @Override
    @PostMapping(path = "/checks", version = "1")
    public PatchWatchOverview checkNow() {
        return watch.checkNow();
    }
}
