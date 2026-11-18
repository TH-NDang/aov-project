package com.wikiaov.spell.internal.catalog.infrastructure;

import com.wikiaov.spell.internal.catalog.persistence.SpellIdentityRepository;
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
public class SpellVideoSubjectProvider implements VideoSubjectProvider {
    private final SpellIdentityRepository spells;

    @Override
    public Set<VideoSubjectKind> kinds() {
        return Set.of(VideoSubjectKind.SPELL);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return kind == VideoSubjectKind.SPELL && spells.existsById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VideoSubject> subjects(String locale) {
        return VideoSubjectName.collapse(VideoSubjectKind.SPELL, spells.videoSubjectNames(), locale, Map.of());
    }
}
