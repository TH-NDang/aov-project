package com.wikiaov.patch.internal.watch.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.patch.internal.watch.domain.FoundPatchNote;
import com.wikiaov.patch.internal.watch.domain.PatchNoteChannel;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The fixtures copy only the structure each publisher's page uses, with shortened text. */
class PatchNoteParsersTest {
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 26);

    @Test
    void readsTheItemsOfAWordPressFeed() {
        String feed = """
                <?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Liên Quân Mobile</title>
                <item>
                  <title>ĐIỀU CHỈNH GIỮA MÙA PB VẾT NỨT THỜI KHÔNG &#8211; 26.11.2026</title>
                  <link>https://lienquan.garena.vn/dieu-chinh-giua-mua-26-11-2026/</link>
                  <pubDate>Wed, 25 Nov 2026 07:52:58 +0000</pubDate>
                  <category><![CDATA[Cập nhật]]></category>
                  <guid isPermaLink="false">https://lienquan.garena.vn/?p=16650</guid>
                </item>
                <item><title>Không có link</title><link></link></item>
                </channel></rss>
                """;

        List<FoundPatchNote> posts = PatchNoteParsers.rss(feed);

        assertThat(posts).singleElement().satisfies(post -> {
            assertThat(post.externalId()).isEqualTo("https://lienquan.garena.vn/?p=16650");
            assertThat(post.url()).isEqualTo("https://lienquan.garena.vn/dieu-chinh-giua-mua-26-11-2026/");
            assertThat(post.title()).isEqualTo("ĐIỀU CHỈNH GIỮA MÙA PB VẾT NỨT THỜI KHÔNG – 26.11.2026");
            assertThat(post.publishedAt()).isEqualTo(Instant.parse("2026-11-25T07:52:58Z"));
            assertThat(post.channel()).isEqualTo(PatchNoteChannel.OFFICIAL);
        });
    }

    @Test
    void keepsOnlyPatchNotesOfTheThaiSitemapAndTellsTestServerNotesApart() {
        String sitemap = """
                <?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://www.rov.in.th/patch-notes</loc></url>
                <url><loc>https://www.rov.in.th/patch-notes/hotfix261126</loc>
                  <lastmod>2026-11-24T16:00:00+07:00</lastmod></url>
                <url><loc>https://www.rov.in.th/patch-notes/expserver261117</loc>
                  <lastmod>2026-11-17</lastmod></url>
                <url><loc>https://www.rov.in.th/news/some-event</loc></url>
                </urlset>
                """;

        List<FoundPatchNote> posts = PatchNoteParsers.sitemap(sitemap);

        assertThat(posts).extracting(FoundPatchNote::externalId).containsExactly("hotfix261126", "expserver261117");
        assertThat(posts).extracting(FoundPatchNote::channel)
                .containsExactly(PatchNoteChannel.OFFICIAL, PatchNoteChannel.EXPERIMENTAL);
        assertThat(posts.get(0).publishedAt()).isEqualTo(Instant.parse("2026-11-24T09:00:00Z"));
        assertThat(posts.get(1).publishedAt()).isEqualTo(Instant.parse("2026-11-16T17:00:00Z"));
        assertThat(posts).allSatisfy(post -> assertThat(post.title()).isNull());
    }

    @Test
    void readsTheExperienceServerListAndPlacesItsDatesInAYear() {
        String page = """
                <div class="p_fy"><ol id="p_names">
                  <li><a href="/show/4051" target="_blank">《傳說對決 體驗服》11 / 24（二) 最新更新內容</a><span>11/24</span></li>
                  <li><a href="/show/3999" target="_blank">《傳說對決 體驗服》12 / 30 最新更新內容</a><span>12/30</span></li>
                </ol></div>
                """;

        List<FoundPatchNote> posts = PatchNoteParsers.twExperience(page, TODAY);

        assertThat(posts).extracting(FoundPatchNote::url)
                .containsExactly("https://exp.moba.garena.tw/show/4051", "https://exp.moba.garena.tw/show/3999");
        assertThat(posts.get(0).externalId()).isEqualTo("4051");
        assertThat(posts.get(0).channel()).isEqualTo(PatchNoteChannel.EXPERIMENTAL);
        assertThat(posts.get(0).publishedAt()).isEqualTo(Instant.parse("2026-11-23T16:00:00Z"));
        assertThat(posts.get(1).publishedAt()).isEqualTo(Instant.parse("2025-12-29T16:00:00Z"));
    }

    @Test
    void keepsOnlyUpdateNoticesOfTheTaiwaneseNewsList() {
        String page = """
                <div class="event"><a href="/news/show/5793" class="event_content">
                  <div class="event_title">11 / 26（四）伺服器不停機更新公告</div><div class="event_date">11/26</div></a></div>
                <div class="event"><a href="/news/show/5793" class="event_list">
                  <div class="event_list_icon">系統</div><div class="event_list_title">11 / 26（四）伺服器不停機更新公告</div>
                  <div class="event_list_date">11/26</div></a></div>
                <div class="event"><a href="/news/show/5795" class="event_list">
                  <div class="event_list_icon">公告</div><div class="event_list_title">停權懲處名單公告（11/25更新）</div>
                  <div class="event_list_date">11/25</div></a></div>
                """;

        List<FoundPatchNote> posts = PatchNoteParsers.twNews(page, TODAY);

        assertThat(posts).singleElement().satisfies(post -> {
            assertThat(post.externalId()).isEqualTo("5793");
            assertThat(post.url()).isEqualTo("https://moba.garena.tw/news/show/5793");
            assertThat(post.title()).isEqualTo("11 / 26（四）伺服器不停機更新公告");
        });
    }

    @Test
    void readsTheRenderedIndonesianListAndPrefersTheEnglishPost() {
        String page = """
                <div class="item"><div class="right"><p class="title">Patch Notes 26 November 2026 [EN]</p>
                  <div class="date">Nov 25, 2026</div><p class="short_desc">Dear Challengers</p>
                  <a class="show-more" href="/post/patch-notes26nov26-en"><span>+</span><span>More</span></a></div></div>
                <div class="item"><div class="right"><p class="title">Patch Note 26 November 2026 [ID]</p>
                  <div class="date">Nov 25, 2026</div>
                  <a class="show-more" href="/post/patch-notes26nov26-id"><span>+</span><span>More</span></a></div></div>
                <div class="item"><div class="right"><p class="title">Patch Note 2 Desember 2026 [ID]</p>
                  <div class="date">Dec 1, 2026</div>
                  <a class="show-more" href="/post/patch-notes2des26-id"><span>+</span><span>More</span></a></div></div>
                <div class="other"><div class="date">Nov 25, 2026</div>
                  <a class="show-more" href="/post/patch-notes26nov26-en"><span>+</span><span>More</span></a></div>
                """;

        List<FoundPatchNote> posts = PatchNoteParsers.garenaId(page);

        assertThat(posts).extracting(FoundPatchNote::externalId)
                .containsExactly("patch-notes26nov26-en", "patch-notes2des26-id");
        assertThat(posts.get(0).title()).isEqualTo("Patch Notes 26 November 2026 [EN]");
        assertThat(posts.get(0).url()).isEqualTo("https://main.aov.garena.co.id/post/patch-notes26nov26-en");
        assertThat(posts.get(0).publishedAt()).isEqualTo(Instant.parse("2026-11-24T17:00:00Z"));
    }

    @Test
    void namesAPostFromItsPageWithoutTheSiteName() {
        String page = """
                <html><head><title>อัปเดตเซิร์ฟเวอร์ทดสอบ 17 พ.ย. 2026 | RoV</title></head><body></body></html>
                """;

        assertThat(PatchNoteParsers.title(page)).isEqualTo("อัปเดตเซิร์ฟเวอร์ทดสอบ 17 พ.ย. 2026");
        assertThat(PatchNoteParsers.title("<html><head></head></html>")).isNull();
    }

    @Test
    void aChangedLayoutYieldsNoPost() {
        assertThat(PatchNoteParsers.twExperience("<html><body><p>Không còn danh sách</p></body></html>", TODAY))
                .isEmpty();
        assertThat(PatchNoteParsers.garenaId("<html><body></body></html>")).isEmpty();
    }
}
