package com.wikiaov.arcana.internal.catalog.infrastructure;

import com.wikiaov.arcana.internal.catalog.persistence.ArcanaIdentityRepository;
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

@Component
@RequiredArgsConstructor
public class ArcanaVideoSubjectProvider implements VideoSubjectProvider {
    private final ArcanaIdentityRepository arcana;

    public Set<VideoSubjectKind> kinds() {
        return Set.of(VideoSubjectKind.ARCANA);
    }

    @Transactional(readOnly = true)
    public boolean exists(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return kind == VideoSubjectKind.ARCANA && arcana.existsById(id);
    }

    @Transactional(readOnly = true)
    public List<VideoSubject> subjects(String locale) {
        return VideoSubjectName.collapse(VideoSubjectKind.ARCANA, arcana.videoSubjectNames(), locale, Map.of());
    }
}
