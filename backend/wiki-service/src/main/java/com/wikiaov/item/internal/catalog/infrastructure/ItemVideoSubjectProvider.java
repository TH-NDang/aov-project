package com.wikiaov.item.internal.catalog.infrastructure;

import com.wikiaov.item.internal.catalog.persistence.ItemIdentityRepository;
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
public class ItemVideoSubjectProvider implements VideoSubjectProvider {
    private final ItemIdentityRepository items;

    @Override
    public Set<VideoSubjectKind> kinds() {
        return Set.of(VideoSubjectKind.ITEM);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return kind == VideoSubjectKind.ITEM && items.existsById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VideoSubject> subjects(String locale) {
        return VideoSubjectName.collapse(VideoSubjectKind.ITEM, items.videoSubjectNames(), locale, Map.of());
    }
}
