package com.wikiaov.enchantment.internal.catalog.infrastructure;

import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentIdentityRepository;
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
public class EnchantmentVideoSubjectProvider implements VideoSubjectProvider {
    private final EnchantmentIdentityRepository enchantments;

    @Override
    public Set<VideoSubjectKind> kinds() {
        return Set.of(VideoSubjectKind.ENCHANTMENT);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return kind == VideoSubjectKind.ENCHANTMENT && enchantments.existsById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<VideoSubject> subjects(String locale) {
        return VideoSubjectName.collapse(VideoSubjectKind.ENCHANTMENT, enchantments.videoSubjectNames(), locale,
                Map.of());
    }
}
