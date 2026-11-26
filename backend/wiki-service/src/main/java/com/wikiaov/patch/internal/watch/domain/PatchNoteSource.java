package com.wikiaov.patch.internal.watch.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * The publishers' pages the patch watch reads (ADR-035). Each one is read from its list only: a feed, a sitemap or the
 * first page of a news list, never every post. {@code MANUAL} holds links an editor adds by hand.
 */
public enum PatchNoteSource {
    /** lienquan.garena.vn, WordPress feed of the update category (cap-nhat). */
    LIENQUAN_VN(PatchNoteRegion.VN, Format.RSS, "https://lienquan.garena.vn/category/cap-nhat/feed/",
            "https://lienquan.garena.vn/category/cap-nhat/", Set.of(PatchNoteChannel.OFFICIAL)),
    /** rov.in.th: its sitemap lists every patch note with a date, live and test server alike. */
    ROV_TH(PatchNoteRegion.TH, Format.SITEMAP, "https://www.rov.in.th/sitemap.xml",
            "https://www.rov.in.th/patch-notes", Set.of(PatchNoteChannel.OFFICIAL, PatchNoteChannel.EXPERIMENTAL)),
    /** exp.moba.garena.tw: the experience server's home page lists its update posts. */
    MOBA_TW_EXP(PatchNoteRegion.TW, Format.TW_EXPERIENCE, "https://exp.moba.garena.tw/", "https://exp.moba.garena.tw/",
            Set.of(PatchNoteChannel.EXPERIMENTAL)),
    /** moba.garena.tw: the first page of the news list, filtered to update notices. */
    MOBA_TW(PatchNoteRegion.TW, Format.TW_NEWS, "https://moba.garena.tw/news", "https://moba.garena.tw/news",
            Set.of(PatchNoteChannel.OFFICIAL)),
    /**
     * main.aov.garena.co.id: its news list is filled in by the page's own scripts, so it is opened in a headless
     * browser that runs on the server only (the page reader of infra/compose.yaml).
     */
    GARENA_ID(PatchNoteRegion.ID, Format.RENDERED, "https://main.aov.garena.co.id/news/update",
            "https://main.aov.garena.co.id/news/update", Set.of(PatchNoteChannel.OFFICIAL)),
    MANUAL(PatchNoteRegion.OTHER, Format.NONE, null, null, Set.of(PatchNoteChannel.values()));

    /** How a source's list is written. */
    public enum Format {
        RSS,
        SITEMAP,
        TW_EXPERIENCE,
        TW_NEWS,
        RENDERED,
        NONE
    }

    private final PatchNoteRegion region;
    private final Format format;
    private final @Nullable String listUrl;
    private final @Nullable String pageUrl;
    private final Set<PatchNoteChannel> channels;

    PatchNoteSource(PatchNoteRegion region, Format format, @Nullable String listUrl, @Nullable String pageUrl,
            Set<PatchNoteChannel> channels) {
        this.region = region;
        this.format = format;
        this.listUrl = listUrl;
        this.pageUrl = pageUrl;
        this.channels = channels;
    }

    /** Sources the check reads, in the order it reads them. */
    public static List<PatchNoteSource> checked() {
        return Arrays.stream(values()).filter(source -> source.format != Format.NONE).toList();
    }

    public PatchNoteRegion region() {
        return region;
    }

    public Format format() {
        return format;
    }

    /** The address the check downloads. Null for {@link #MANUAL}. */
    public @Nullable String listUrl() {
        return listUrl;
    }

    /** The address a reader opens to see the same list. Null for {@link #MANUAL}. */
    public @Nullable String pageUrl() {
        return pageUrl;
    }

    public Set<PatchNoteChannel> channels() {
        return channels;
    }

    /** Whether reading this source needs the page reader, which only the server has. */
    public boolean needsPageReader() {
        return format == Format.RENDERED;
    }
}
