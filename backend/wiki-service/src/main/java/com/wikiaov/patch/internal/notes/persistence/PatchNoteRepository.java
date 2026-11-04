package com.wikiaov.patch.internal.notes.persistence;

import com.wikiaov.patch.internal.notes.persistence.entity.PatchNote;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatchNoteRepository extends JpaRepository<PatchNote, UUID> {
    Optional<PatchNote> findByVariantIdAndLocale(UUID variantId, String locale);
}
