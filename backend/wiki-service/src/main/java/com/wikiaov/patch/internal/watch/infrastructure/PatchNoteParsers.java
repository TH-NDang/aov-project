package com.wikiaov.patch.internal.watch.infrastructure;

import com.wikiaov.patch.internal.watch.domain.FoundPatchNote;
import com.wikiaov.patch.internal.watch.domain.PatchNoteChannel;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.jspecify.annotations.Nullable;

/**
 * Turns each publisher's list into posts. Every reader looks only for the few elements its page is known to use
 * (patch-note-sources in the docs of ADR-035), so a changed layout yields no post and the check reports it.
 */
final class PatchNoteParsers {
    static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");
    static final ZoneId JAKARTA = ZoneId.of("Asia/Jakarta");

    private static final Pattern SHOW_ID = Pattern.compile("/show/(\\d+)");
    private static final Pattern MONTH_DAY = Pattern.compile("(\\d{1,2})\\s*/\\s*(\\d{1,2})");
    /** Titles of the Taiwanese news list that announce a game update; event and ban notices are left out. */
    private static final Pattern TW_UPDATE_TITLE = Pattern.compile("更新公告|改版|版本更新|更新內容|平衡調整");
    private static final DateTimeFormatter ENGLISH_DATE = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);
    /** A month and day without a year is placed in the past year when it would be this far in the future. */
    private static final int FUTURE_DAYS = 7;

    private PatchNoteParsers() {
    }

    /**
     * @param today the reading day, to place the "MM/DD" dates of the Taiwanese pages in a year
     */
    static List<FoundPatchNote> parse(PatchNoteSource source, String body, LocalDate today) {
        return switch (source.format()) {
            case RSS -> rss(body);
            case SITEMAP -> sitemap(body);
            case TW_EXPERIENCE -> twExperience(body, today);
            case TW_NEWS -> twNews(body, today);
            case RENDERED -> garenaId(body);
            case NONE -> List.of();
        };
    }

    /** WordPress feed: every item of the category, the guid as id. */
    static List<FoundPatchNote> rss(String body) {
        Document feed = Jsoup.parse(body, "", Parser.xmlParser());
        List<FoundPatchNote> found = new ArrayList<>();
        for (Element item : feed.select("item")) {
            String link = text(item.selectFirst("link"));
            if (!web(link)) {
                continue;
            }
            String guid = text(item.selectFirst("guid"));
            found.add(new FoundPatchNote(guid.isEmpty() ? link : guid, link, blankToNull(text(item.selectFirst(
                    "title"))), PatchNoteChannel.OFFICIAL, rfc1123(text(item.selectFirst("pubDate")))));
        }
        return found;
    }

    /** Sitemap of rov.in.th: its patch-note pages, the slug as id; "expserver" slugs are test-server notes. */
    static List<FoundPatchNote> sitemap(String body) {
        Document map = Jsoup.parse(body, "", Parser.xmlParser());
        List<FoundPatchNote> found = new ArrayList<>();
        for (Element url : map.select("url")) {
            String loc = text(url.selectFirst("loc"));
            String slug = patchNoteSlug(loc);
            if (slug == null) {
                continue;
            }
            PatchNoteChannel channel = slug.startsWith("expserver")
                    ? PatchNoteChannel.EXPERIMENTAL
                    : PatchNoteChannel.OFFICIAL;
            found.add(new FoundPatchNote(slug, loc, null, channel, isoDate(text(url.selectFirst("lastmod")))));
        }
        return found;
    }

    /** Home page of the Taiwanese experience server: the update list, the post number as id. */
    static List<FoundPatchNote> twExperience(String body, LocalDate today) {
        Document page = Jsoup.parse(body, "https://exp.moba.garena.tw/");
        List<FoundPatchNote> found = new ArrayList<>();
        for (Element row : page.select("#p_names li")) {
            Element link = row.selectFirst("a[href*=/show/]");
            if (link == null) {
                continue;
            }
            String id = showId(link.attr("href"));
            if (id == null) {
                continue;
            }
            found.add(new FoundPatchNote(id, link.absUrl("href"), blankToNull(link.text()),
                    PatchNoteChannel.EXPERIMENTAL, monthDay(text(row.selectFirst("span")), today, TAIPEI)));
        }
        return found;
    }

    /** First page of moba.garena.tw/news: only the update notices, the post number as id. */
    static List<FoundPatchNote> twNews(String body, LocalDate today) {
        Document page = Jsoup.parse(body, "https://moba.garena.tw/");
        Map<String, FoundPatchNote> found = new LinkedHashMap<>();
        for (Element link : page.select("a.event_list[href*=/show/], a.event_content[href*=/show/]")) {
            String id = showId(link.attr("href"));
            String title = text(link.selectFirst(".event_list_title, .event_title"));
            if (id == null || !TW_UPDATE_TITLE.matcher(title).find()) {
                continue;
            }
            found.putIfAbsent(id, new FoundPatchNote(id, link.absUrl("href"), title, PatchNoteChannel.OFFICIAL,
                    monthDay(text(link.selectFirst(".event_list_date, .event_date")), today, TAIPEI)));
        }
        return List.copyOf(found.values());
    }

    /**
     * News list of main.aov.garena.co.id as the page reader rendered it. Each patch comes in English and Indonesian;
     * the Indonesian post is left out when its English twin is listed.
     */
    static List<FoundPatchNote> garenaId(String body) {
        Document page = Jsoup.parse(body, "https://main.aov.garena.co.id/");
        Map<String, FoundPatchNote> found = new LinkedHashMap<>();
        for (Element link : page.select("a[href^=/post/]")) {
            String slug = link.attr("href").substring("/post/".length()).strip();
            if (slug.isEmpty() || slug.contains("/")) {
                continue;
            }
            Element card = link.parent();
            String title = card == null ? "" : text(card.selectFirst("p.title"));
            Instant date = card == null ? null : englishDate(text(card.selectFirst(".date")));
            FoundPatchNote post = new FoundPatchNote(slug, link.absUrl("href"), blankToNull(title),
                    PatchNoteChannel.OFFICIAL, date);
            FoundPatchNote earlier = found.get(slug);
            if (earlier == null || earlier.title() == null && post.title() != null) {
                found.put(slug, post);
            }
        }

        Set<String> slugs = found.keySet();
        return found.values().stream()
                .filter(post -> !post.externalId().endsWith("-id")
                        || !slugs.contains(post.externalId().substring(0, post.externalId().length() - 3) + "-en"))
                .collect(Collectors.toList());
    }

    /** The title of a post page: its Open Graph title, else its document title, without the site name. */
    static @Nullable String title(String html) {
        Document page = Jsoup.parse(html);
        Element og = page.selectFirst("meta[property=og:title]");
        String title = og != null && !og.attr("content").isBlank() ? og.attr("content") : page.title();
        title = title.strip();
        int bar = title.lastIndexOf(" | ");
        if (bar > 0) {
            title = title.substring(0, bar).strip();
        }
        return blankToNull(title);
    }

    private static @Nullable String patchNoteSlug(String loc) {
        try {
            String path = URI.create(loc).getPath();
            if (path == null || !path.startsWith("/patch-notes/")) {
                return null;
            }
            String slug = path.substring("/patch-notes/".length());
            return slug.isEmpty() || slug.contains("/") ? null : slug;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static @Nullable String showId(String href) {
        Matcher matcher = SHOW_ID.matcher(href);
        return matcher.find() ? matcher.group(1) : null;
    }

    /** "11/24" in the reading year, or the year before when that date is still well ahead. */
    static @Nullable Instant monthDay(String value, LocalDate today, ZoneId zone) {
        Matcher matcher = MONTH_DAY.matcher(value);
        if (!matcher.find()) {
            return null;
        }
        try {
            MonthDay day = MonthDay.of(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)));
            LocalDate date = day.atYear(today.getYear());
            if (date.isAfter(today.plusDays(FUTURE_DAYS))) {
                date = day.atYear(today.getYear() - 1);
            }
            return date.atStartOfDay(zone).toInstant();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static @Nullable Instant rfc1123(String value) {
        try {
            return value.isEmpty()
                    ? null
                    : ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static @Nullable Instant isoDate(String value) {
        if (value.isEmpty()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value).toInstant();
        } catch (DateTimeParseException ex) {
            try {
                return LocalDate.parse(value).atStartOfDay(ZoneId.of("Asia/Bangkok")).toInstant();
            } catch (DateTimeParseException again) {
                return null;
            }
        }
    }

    private static @Nullable Instant englishDate(String value) {
        try {
            return value.isEmpty() ? null : LocalDate.parse(value, ENGLISH_DATE).atStartOfDay(JAKARTA).toInstant();
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private static boolean web(String link) {
        return link.startsWith("https://") || link.startsWith("http://");
    }

    private static String text(@Nullable Element element) {
        return element == null ? "" : element.text().strip();
    }

    private static @Nullable String blankToNull(String value) {
        return value.isBlank() ? null : value;
    }
}
