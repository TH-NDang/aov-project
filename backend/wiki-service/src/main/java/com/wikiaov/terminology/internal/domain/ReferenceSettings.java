package com.wikiaov.terminology.internal.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

public record ReferenceSettings(
        int schemaVersion,
        boolean autoRecognize,
        String fallbackLocale,
        List<Entry> entities
) {
    public record Translation(
            String locale,
            String name,
            List<String> aliases,
            String description
    ) {
    }
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Display(
            String color,
            Boolean underline,
            Boolean showIcon
    ) {
    }
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Destinations(
            String admin,
            String wiki
    ) {
    }
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Entry(
            String id,
            String kind,
            List<Translation> translations,
            String icon,
            Boolean autoMatch,
            Display display,
            Destinations destinations
    ) {
    }

    public void validate() {
        require(schemaVersion == 1 && locale(fallbackLocale), "Invalid settings schema or fallback locale.");
        require(entities != null && entities.size() <= 2000, "Invalid reference catalog size.");
        var keys = new HashSet<String>();
        long characters = 0;
        for (var e : entities) {
            require(e != null && text(e.id(), 128, false) && e.id().matches("[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}")
                    && Set.of("hero", "item", "enchantment", "arcana", "spell", "term").contains(e.kind()),
                    "Invalid reference identity.");
            require(keys.add(e.kind() + ":" + e.id()), "Duplicate reference identity.");
            require(e.translations() != null && !e.translations().isEmpty() && e.translations().size() <= 30,
                    "Invalid translations.");
            var locales = new HashSet<String>();
            for (var t : e.translations()) {
                require(t != null && locale(t.locale()) && locales.add(t.locale().toLowerCase(Locale.ROOT))
                        && text(t.name(), 200, false) && text(t.description(), 4000, true)
                        && t.aliases() != null && t.aliases().size() <= 20, "Invalid reference translation.");
                characters += t.name().length() + t.description().length();
                for (var alias : t.aliases()) {
                    require(text(alias, 200, false), "Invalid reference alias.");
                    characters += alias.length();
                }
            }
            require(e.icon() == null || safeUrl(e.icon(), false), "Invalid reference icon URL.");
            require(e.display() == null || e.display().color() == null
                    || e.display().color().matches("#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{5})?"),
                    "Invalid reference color.");
            require(e.destinations() == null
                    || ((e.destinations().admin() == null || safeUrl(e.destinations().admin(), true))
                            && (e.destinations().wiki() == null || safeUrl(e.destinations().wiki(), true))),
                    "Reference destinations must be local paths.");
        }
        require(characters <= 4000000, "Reference catalog exceeds the text limit.");
    }

    public ReferenceSettings publicView() {
        return new ReferenceSettings(schemaVersion, autoRecognize, fallbackLocale, entities.stream()
                .map(e -> new Entry(e.id(), e.kind(), e.translations(), e.icon(), e.autoMatch(), e.display(),
                        e.destinations() == null ? null : new Destinations(null, e.destinations().wiki())))
                .toList());
    }

    private static boolean locale(String value) {
        return text(value, 64, false) && value.matches("[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*");
    }
    private static boolean text(String value, int max, boolean empty) {
        return value != null && value.length() <= max && (empty || !value.isBlank());
    }
    private static boolean safeUrl(String value, boolean localOnly) {
        if (!text(value, 2048, false) || !value.equals(value.strip()))
            return false;
        try {
            String decoded = value;
            for (int i = 0; i < 3; i++)
                decoded = URLDecoder.decode(decoded.replace("+", "%2B"), StandardCharsets.UTF_8);
            if (decoded.matches("(?s).*[\\x00-\\x20\\x7f\\\\].*") || decoded.startsWith("//"))
                return false;
            if (value.startsWith("/") && decoded.startsWith("/"))
                return true;
            if (localOnly)
                return false;
            var uri = URI.create(value);
            return Set.of("http", "https").contains(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
    private static void require(boolean valid, String detail) {
        if (!valid)
            throw new IllegalArgumentException(detail);
    }
}
