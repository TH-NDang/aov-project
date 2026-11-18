package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.ImageOption;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.media.persistence.entity.HeroImageOption;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import com.wikiaov.hero.internal.media.persistence.entity.MediaRevision;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import com.wikiaov.hero.internal.sections.persistence.SectionRevisionRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroMediaSnapshots implements HeroSectionSnapshots {
    private final MediaRevisionRepository revisions;
    private final MediaBindingRepository bindings;
    private final HeroImageOptionRepository options;
    private final HeroSectionLifecycle lifecycle;
    private final HeroSectionSources sources;

    @Override
    public HeroSection section() {
        return HeroSection.MEDIA_BINDINGS;
    }

    @Override
    public SectionRevisionRepository<?> revisions() {
        return revisions;
    }

    @Override
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new MediaRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Bindings) content;
            value.bindings()
                    .forEach((role, asset) -> bindings.save(new MediaBindingRow(revision.getId(), role.name(), asset)));
            value.images().forEach((role, images) -> {
                for (int n = 0; n < images.size(); n++) {
                    options.save(new HeroImageOption(revision.getId(), role.name(), n, images.get(n).assetId(),
                            images.get(n).label()));
                }
            });
            sources.save(section(), revision.getId(), value.sources());
        }
        revisions.flush();
        return revision.getId();
    }

    @Override
    public Bindings content(UUID id) {
        return contents(Collections.singletonList(id)).get(id);
    }

    /** Reads many snapshots in a bounded number of queries, for lists that cover every hero. */
    public Map<UUID, Bindings> contents(Collection<UUID> ids) {
        var references = sources.find(section(), ids);
        var boundAssets = bindings.findByMediaBindingRevisionIdIn(ids, Sort.by("mediaRole")).stream()
                .collect(Collectors.groupingBy(MediaBindingRow::getMediaBindingRevisionId));
        var imageOptions = options.findByMediaBindingRevisionIdIn(ids, Sort.by("imageOrder")).stream()
                .collect(Collectors.groupingBy(HeroImageOption::getMediaBindingRevisionId));

        Map<UUID, Bindings> result = new HashMap<>();
        for (UUID id : ids) {
            Map<MediaRole, UUID> assets = new EnumMap<>(MediaRole.class);
            boundAssets.getOrDefault(id, List.of())
                    .forEach(binding -> assets.put(MediaRole.valueOf(binding.getMediaRole()), binding.getAssetId()));
            Map<MediaRole, List<ImageOption>> images = new EnumMap<>(MediaRole.class);
            imageOptions.getOrDefault(id, List.of()).forEach(option -> images
                    .computeIfAbsent(MediaRole.valueOf(option.getMediaRole()), ignored -> new ArrayList<>())
                    .add(new ImageOption(option.getAssetId(), option.getLabel())));
            result.put(id, new Bindings(assets, references.getOrDefault(id, List.of()), images));
        }
        return result;
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
