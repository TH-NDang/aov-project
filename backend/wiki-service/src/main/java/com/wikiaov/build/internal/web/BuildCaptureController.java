package com.wikiaov.build.internal.web;

import com.wikiaov.build.internal.application.BuildCaptures;
import com.wikiaov.build.internal.application.BuildCommands.ConfirmCapture;
import com.wikiaov.build.internal.application.BuildCommands.ImportCapture;
import com.wikiaov.build.internal.application.BuildCommands.ReviewBuild;
import com.wikiaov.build.internal.application.response.BuildViews;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/build-captures")
public class BuildCaptureController implements BuildCaptureApi {
    private final BuildCaptures captures;

    public BuildCaptureController(BuildCaptures captures) {
        this.captures = captures;
    }

    @Override
    @GetMapping(version = "1")
    public PageSlice<BuildViews.Summary> list(@RequestParam(required = false) String region,
            @RequestParam(required = false) String source, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "source", "page", "size"));
        return captures.list(region, source, page, size);
    }

    @Override
    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public BuildViews.Detail importCapture(@RequestBody ImportCapture body) {
        return captures.importCapture(body);
    }

    @Override
    @GetMapping(path = "/{captureId}", version = "1")
    public BuildViews.Detail detail(@PathVariable UUID captureId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return captures.detail(captureId);
    }

    @Override
    @PutMapping(path = "/{captureId}/builds/{buildId}", version = "1")
    public BuildViews.Reviewed review(@PathVariable UUID captureId, @PathVariable UUID buildId,
            @RequestBody ReviewBuild body) {
        return captures.review(captureId, buildId, body);
    }

    @Override
    @PostMapping(path = "/{captureId}/confirm", version = "1")
    public BuildViews.Summary confirm(@PathVariable UUID captureId, @RequestBody ConfirmCapture body) {
        return captures.confirm(captureId, body);
    }

    @Override
    @DeleteMapping(path = "/{captureId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID captureId, @RequestParam long expectedVersion) {
        captures.delete(captureId, expectedVersion);
    }
}
