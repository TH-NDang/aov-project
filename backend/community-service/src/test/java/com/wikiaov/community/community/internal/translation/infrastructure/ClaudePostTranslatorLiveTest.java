package com.wikiaov.community.community.internal.translation.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.community.internal.translation.application.TranslationSettings;
import com.wikiaov.community.community.internal.translation.application.port.PostTranslator;
import com.wikiaov.community.community.internal.translation.domain.Glossary;
import com.wikiaov.community.community.internal.translation.domain.TranslationChecks;
import com.wikiaov.community.community.internal.translation.domain.TranslationPrompt;
import java.awt.Color;
import java.awt.Font;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * One real call to the Claude API, run by hand where a key is set: it proves the request shape, the schema and the
 * image path against the live API. CI has no key, so it is skipped there.
 */
@EnabledIfEnvironmentVariable(named = "ANTHROPIC_API_KEY", matches = ".+")
class ClaudePostTranslatorLiveTest {
    @Test
    void aVietnamesePostWithAScreenshotComesBackInEnglish() throws Exception {
        var settings = new TranslationSettings(System.getenv("ANTHROPIC_API_KEY"), "claude-haiku-5-5", "medium",
                8000, Duration.ofSeconds(60), List.of("vi-VN", "en-US"), List.of("vi-VN", "en-US"), "VN",
                Duration.ofMinutes(15), List.of(), 4, 5_000_000, 30, BigDecimal.ONE, new BigDecimal("0.10"),
                new BigDecimal("0.50"));
        var translator = new ClaudePostTranslator(settings);
        var glossary = Glossary.of(List.of(
                new Glossary.Term("spell:1", "spell", Map.of("vi-VN", new Glossary.Names("Trừng trị", List.of()),
                        "en-US", new Glossary.Names("Punish", List.of()))),
                new Glossary.Term("term:quan-huy", "term", Map.of("vi-VN", new Glossary.Names("Quân Huy",
                        List.of("QH")), "en-US", new Glossary.Names("Vouchers", List.of("voucher"))))),
                Set.of("Laville"));
        String body = "<ref=hero:7f3c>Laville</ref> giờ bá quá, nhớ mang Trừng trị nha ae. Skin mới 199 QH 👇";
        var lines = glossary.lines(body, "en-US", true);
        String system = TranslationPrompt.system("en-US", lines, 1);
        String text = TranslationPrompt.post(null, body, 1);

        try {
            var result = translator.translate("en-US", system, text, List.of(screenshot()), null);
            var failures = TranslationChecks.failures(new TranslationChecks.Source(null, body, 1), result.post(),
                    "en-US", lines, glossary.keptNames());
            System.out.println("Live translation: " + result.post());
            System.out.println("Model " + result.model() + ", tokens in/out " + result.inputTokens() + "/"
                    + result.outputTokens() + ", failed checks " + failures);

            assertThat(result.post().body()).contains("<ref=hero:7f3c>Laville</ref>").contains("Punish");
            assertThat(result.post().images()).hasSize(1);
            assertThat(result.post().images().getFirst().hasText()).isTrue();
        } finally {
            translator.destroy();
        }
    }

    /** A shop-like picture with Vietnamese words on it. */
    private static PostTranslator.Image screenshot() throws Exception {
        var image = new BufferedImage(640, 240, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        graphics.setColor(new Color(20, 24, 40));
        graphics.fillRect(0, 0, 640, 240);
        graphics.setColor(Color.WHITE);
        graphics.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 34));
        graphics.drawString("CỬA HÀNG", 40, 70);
        graphics.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 28));
        graphics.drawString("Trang phục mới: Laville Thần Kiếm", 40, 130);
        graphics.drawString("Giá: 199 Quân Huy  -  Mua ngay", 40, 185);
        graphics.dispose();
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "png", bytes);
        return new PostTranslator.Image(bytes.toByteArray(), "image/png");
    }
}
