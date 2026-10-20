package com.wikiaov.hero.internal.infrastructure;
import com.wikiaov.hero.internal.application.service.HeroQueries;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.terminology.PublicReferenceProvider;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class HeroPublicReferences implements PublicReferenceProvider {
    private final HeroQueries heroes;
    public HeroPublicReferences(HeroQueries heroes) {
        this.heroes = heroes;
    }
    @SuppressWarnings("unchecked")
    public List<Candidate> references(String region, String locale) {
        var output = new ArrayList<Candidate>();
        for (int page = 0;; page++) {
            var result = heroes.list(region, locale, page, 100, "", null, "code,asc");
            var rows = (List<Map<String, Object>>) result.get("items");
            for (var row : rows) {
                var head = (MediaAssetReference) row.get("head");
                output.add(new Candidate((UUID) row.get("id"), "hero", (String) row.get("name"), "",
                        (String) row.get("actualLocale"), head == null ? null : head.currentVersion().url()));
            }
            if (rows.size() < 100 || output.size() >= ((Number) result.get("totalElements")).longValue())
                break;
        }
        return output;
    }
}
