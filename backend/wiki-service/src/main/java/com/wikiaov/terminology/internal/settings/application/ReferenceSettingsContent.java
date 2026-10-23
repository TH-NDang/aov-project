package com.wikiaov.terminology.internal.settings.application;

import com.wikiaov.terminology.internal.domain.ReferenceSettings.Entry;
import com.wikiaov.terminology.internal.domain.ReferenceSettings.Translation;
import com.wikiaov.terminology.internal.settings.persistence.ReferenceEntryRepository;
import com.wikiaov.terminology.internal.settings.persistence.ReferenceTranslationRepository;
import com.wikiaov.terminology.internal.settings.persistence.entity.ReferenceEntry;
import com.wikiaov.terminology.internal.settings.persistence.entity.ReferenceTranslation;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Owns the ordered reference entries and their localized text as one content snapshot. */
@Component
class ReferenceSettingsContent {
    private final ReferenceEntryRepository entries;
    private final ReferenceTranslationRepository translations;

    ReferenceSettingsContent(ReferenceEntryRepository entries, ReferenceTranslationRepository translations) {
        this.entries = entries;
        this.translations = translations;
    }

    void replace(List<Entry> content) {
        translations.deleteAllInBatch();
        entries.deleteAllInBatch();
        var entryRows = new ArrayList<ReferenceEntry>();
        var translationRows = new ArrayList<ReferenceTranslation>();
        for (int position = 0; position < content.size(); position++) {
            var value = content.get(position);
            var row = entry(value, position);
            entryRows.add(row);
            value.translations().forEach(text -> translationRows.add(translation(row.getId(), text)));
        }
        entries.saveAllAndFlush(entryRows);
        translations.saveAllAndFlush(translationRows);
    }

    List<Entry> entries() {
        var copies = translations.findAll().stream().collect(Collectors.groupingBy(ReferenceTranslation::getEntryId));
        return entries.findAllByOrderByDisplayOrderAsc().stream().map(row -> entry(row, copies)).toList();
    }

    private static ReferenceEntry entry(Entry value, int position) {
        var row = new ReferenceEntry();
        row.setId(UUID.randomUUID());
        row.setReferenceKey(value.id());
        row.setKind(value.kind());
        row.setDisplayOrder(position);
        row.setIcon(value.icon());
        row.setAutoMatch(value.autoMatch());
        row.setDisplay(value.display());
        row.setDestinations(value.destinations());
        return row;
    }

    private static ReferenceTranslation translation(UUID entryId, Translation text) {
        var row = new ReferenceTranslation();
        row.setId(UUID.randomUUID());
        row.setEntryId(entryId);
        row.setLocale(text.locale());
        row.setName(text.name());
        row.setDescription(text.description());
        row.setAliases(text.aliases());
        return row;
    }

    private static Entry entry(ReferenceEntry row, Map<UUID, List<ReferenceTranslation>> copies) {
        var localized = copies.getOrDefault(row.getId(), List.of()).stream()
                .sorted(Comparator.comparing(ReferenceTranslation::getLocale))
                .map(text -> new Translation(text.getLocale(), text.getName(), text.getAliases(),
                        text.getDescription()))
                .toList();
        return new Entry(row.getReferenceKey(), row.getKind(), localized, row.getIcon(), row.getAutoMatch(),
                row.getDisplay(), row.getDestinations());
    }
}
