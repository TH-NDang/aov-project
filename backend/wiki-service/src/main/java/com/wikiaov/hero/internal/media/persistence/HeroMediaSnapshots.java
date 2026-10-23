package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.media.persistence.entity.HeroImageOption;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import com.wikiaov.hero.internal.media.persistence.entity.MediaRevision;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import java.time.Instant;
import java.util.*;
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
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new MediaRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Bindings) content;
            value.bindings()
                    .forEach((role, asset) -> bindings.save(new MediaBindingRow(revision.getId(), role.name(), asset)));
            value.images().forEach((role, images) -> {
                for (int n = 0; n < images.size(); n++)
                    options.save(new HeroImageOption(revision.getId(), role.name(), n, images.get(n).assetId(),
                            images.get(n).label()));
            });
            sources.save(section(), revision.getId(), value.sources());
        }
        revisions.flush();
        return revision.getId();
    }

    @Override
    public Bindings content(UUID id) {
        var references = sources.find(section(), id);
        var ids = Collections.singletonList(id);
        Map<MediaRole, UUID> assets = new EnumMap<>(MediaRole.class);
        bindings.findByMediaBindingRevisionIdIn(ids, Sort.by("mediaRole"))
                .forEach(binding -> assets.put(MediaRole.valueOf(binding.getMediaRole()), binding.getAssetId()));
        Map<MediaRole, List<ImageOption>> images = new EnumMap<>(MediaRole.class);
        options.findByMediaBindingRevisionIdIn(ids, Sort.by("imageOrder")).forEach(option -> images
                .computeIfAbsent(MediaRole.valueOf(option.getMediaRole()), ignored -> new ArrayList<>())
                .add(new ImageOption(option.getAssetId(), option.getLabel())));
        return new Bindings(assets, references, images);
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
