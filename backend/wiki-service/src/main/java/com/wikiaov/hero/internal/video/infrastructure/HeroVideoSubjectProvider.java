package com.wikiaov.hero.internal.video.infrastructure;

import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.skins.persistence.SkinIdentityRepository;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinIdentityRow;
import com.wikiaov.hero.internal.video.persistence.HeroVideoSubjectRepository;
import com.wikiaov.video.VideoSubject;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.VideoSubjectName;
import com.wikiaov.video.VideoSubjectProvider;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class HeroVideoSubjectProvider implements VideoSubjectProvider {
    private final HeroIdentityRepository heroes;
    private final SkinIdentityRepository skins;
    private final HeroVideoSubjectRepository names;

    @Override
    public Set<VideoSubjectKind> kinds() {
        return Set.of(VideoSubjectKind.HERO, VideoSubjectKind.SKIN);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean exists(VideoSubjectKind kind, UUID id, @Nullable String key) {
        return switch (kind) {
            case HERO -> heroes.existsById(id);
            case SKIN -> key != null && skins.existsById(new SkinIdentityRow.Key(id, key));
            default -> false;
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<VideoSubject> subjects(String locale) {
        Map<UUID, List<String>> legacyCodes = names.legacyCodes().stream()
                .collect(Collectors.groupingBy(HeroVideoSubjectRepository.LegacyCode::getHeroId,
                        Collectors.mapping(HeroVideoSubjectRepository.LegacyCode::getLegacyCode, Collectors.toList())));

        var subjects = new ArrayList<VideoSubject>();
        subjects.addAll(VideoSubjectName.collapse(VideoSubjectKind.HERO, names.heroNames(), locale, legacyCodes));
        subjects.addAll(VideoSubjectName.collapse(VideoSubjectKind.SKIN, names.skinNames(), locale, Map.of()));

        return subjects;
    }
}
