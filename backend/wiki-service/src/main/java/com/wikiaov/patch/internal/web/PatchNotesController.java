package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.notes.application.PatchNotes;
import com.wikiaov.patch.internal.notes.application.PatchNotes.*;
import com.wikiaov.platform.ApiPaths;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping(ApiPaths.ADMIN + "/patch-variants/{id}/notes/{locale}")
public class PatchNotesController implements PatchNotesApi {
    private final PatchNotes notes;

    @GetMapping(version = "1")
    public PatchNoteView read(@PathVariable UUID id, @PathVariable String locale) {
        return notes.read(id, locale);
    }

    @PutMapping(version = "1")
    public PatchNoteView save(@PathVariable UUID id, @PathVariable String locale, @RequestBody UpdatePatchNote input) {
        return notes.save(id, locale, input);
    }
}
