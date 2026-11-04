package com.wikiaov.patch.internal.notes.application;

import com.wikiaov.access.*;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.notes.persistence.PatchNoteRepository;
import com.wikiaov.patch.internal.notes.persistence.entity.PatchNote;
import com.wikiaov.platform.ApiException;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class PatchNotes {
    private final PatchNoteRepository notes;
    private final PatchVariantRepository variants;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final PatchDataReviews reviews;

    public record PatchNoteView(
            String body,
            long version
    ) {
    }

    public record UpdatePatchNote(
            String body,
            Long expectedVersion
    ) {
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PatchNoteView read(UUID id, String locale) {
        validateLocale(locale);
        if (!variants.existsById(id))
            throw notFound();
        return notes.findByVariantIdAndLocale(id, locale).map(PatchNotes::view).orElse(new PatchNoteView("", 0));
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public PatchNoteView save(UUID id, String locale, UpdatePatchNote input) {
        validateLocale(locale);
        if (input.body() == null || input.body().length() > 20000 || input.expectedVersion() == null
                || input.expectedVersion() < 0)
            throw new ApiException(PatchErrorCode.PATCH_INVALID,
                    "Provide note text up to 20000 characters and its version.");

        variants.lockById(id).orElseThrow(PatchNotes::notFound);
        var note = notes.findByVariantIdAndLocale(id, locale).orElseGet(PatchNote::new);
        if (note.getVersion() != input.expectedVersion())
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT,
                    "The patch notes have changed. Reload before saving.");
        String body = input.body().strip();
        if (body.equals(Objects.toString(note.getBody(), "")))
            return new PatchNoteView(body, note.getVersion());

        if (note.getId() == null) {
            note.setId(UUID.randomUUID());
            note.setVariantId(id);
            note.setLocale(locale);
        }
        note.setBody(body);
        note.setVersion(note.getVersion() + 1);
        notes.saveAndFlush(note);
        reviews.markDirty(id);
        audit.record(new AuditEntry(actors.require(), "PATCH_NOTES_UPDATED", "PATCH", id, null, input.expectedVersion(),
                note.getVersion(), null, Map.of("locale", locale)));

        return view(note);
    }

    private static PatchNoteView view(PatchNote note) {
        return new PatchNoteView(note.getBody(), note.getVersion());
    }

    private static void validateLocale(String locale) {
        if (locale == null || locale.length() > 35 || !Locale.forLanguageTag(locale).toLanguageTag().equals(locale))
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "Use a canonical BCP 47 locale.");
    }

    private static ApiException notFound() {
        return new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant was not found.");
    }
}
