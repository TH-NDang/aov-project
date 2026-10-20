package com.wikiaov.spell.internal.infrastructure;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.spell.internal.application.service.SpellCatalog;
import com.wikiaov.terminology.PublicReferenceProvider;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class SpellPublicReferences implements PublicReferenceProvider {
    private final SpellCatalog items;
    private final MediaAssets media;
    public SpellPublicReferences(SpellCatalog items, MediaAssets media) {
        this.items = items;
        this.media = media;
    }
    public List<Candidate> references(String region, String locale) {
        var output = new ArrayList<Candidate>();
        for (int page = 0;; page++) {
            var result = items.published(region, locale, page, 100);
            for (var row : result.items()) {
                var copies = row.content().translations();
                var copy = copies.stream().filter(t -> t.locale().equalsIgnoreCase(locale)).findFirst()
                        .orElseGet(() -> copies.stream().filter(t -> t.locale().equals("vi-VN")).findFirst()
                                .orElseGet(() -> copies.getFirst()));
                var asset = row.content().iconAssetId();
                String icon = asset == null
                        ? null
                        : media.find(asset).filter(a -> a.usable())
                                .map(a -> a.currentVersion().url()).orElse(null);
                String description = copy.description() == null ? "" : copy.description();
                output.add(new Candidate(row.id(), "spell", copy.name(),
                        description.substring(0, Math.min(4000, description.length())), copy.locale(), icon));
            }
            if (result.items().size() < 100 || output.size() >= result.totalElements())
                break;
        }
        return output;
    }
}
