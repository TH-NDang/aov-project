package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.PatchSource;
import com.wikiaov.patch.internal.notes.application.PatchSourceLinks;
import com.wikiaov.patch.internal.notes.application.PatchSourceLinks.UpdatePatchSources;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/patch-variants/{id}/sources")
public class PatchSourcesController implements PatchSourcesApi {
    private final PatchSourceLinks sources;

    @Override
    @GetMapping(version = "1")
    public List<PatchSource> read(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return sources.read(id);
    }

    @Override
    @PutMapping(version = "1")
    public List<PatchSource> save(@PathVariable UUID id, @RequestBody UpdatePatchSources input) {
        return sources.save(id, input);
    }
}
