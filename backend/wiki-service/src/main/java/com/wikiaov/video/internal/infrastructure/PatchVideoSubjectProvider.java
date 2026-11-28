package com.wikiaov.video.internal.infrastructure;

import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantTitle;
import com.wikiaov.video.VideoSubject;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.VideoSubjectName;
import com.wikiaov.video.VideoSubjectProvider;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Patch variants as video subjects. The video module already reads the patch module, so it answers for patches itself
 * instead of the patch module depending back on it.
 */
@Component
@RequiredArgsConstructor
public class PatchVideoSubjectProvider implements VideoSubjectProvider {
    private final GameplayContexts patches;

    @Override
    public Set<VideoSubjectKind> kinds() {
        return Set.of(VideoSubjectKind.PATCH);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return kind == VideoSubjectKind.PATCH && key == null && patches.findVariant(id).isPresent();
    }

    @Override
    @Transactional(readOnly = true)
    public List<VideoSubject> subjects(String locale) {
        List<VideoSubjectName> names = patches.variantTitles().stream().map(PatchVideoSubjectProvider::name).toList();
        return VideoSubjectName.collapse(VideoSubjectKind.PATCH, names, locale, Map.of());
    }

    private static VideoSubjectName name(PatchVariantTitle title) {
        return new VideoSubjectName(title.variantId(), title.patchCode(), title.locale(), title.title(), 0);
    }
}
