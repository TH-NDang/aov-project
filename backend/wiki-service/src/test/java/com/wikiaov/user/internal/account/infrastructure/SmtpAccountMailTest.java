package com.wikiaov.user.internal.account.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.user.internal.account.application.port.AccountMail.Language;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class SmtpAccountMailTest {
    private final CapturingSender sender = new CapturingSender();
    private final SmtpAccountMail mail = new SmtpAccountMail(provider(sender),
            new SmtpAccountMail.Properties("AOV <no-reply@example.com>", "AOV"));

    @Test
    void thePasswordCodeMailKeepsItsVietnameseWordingByDefault() throws Exception {
        mail.sendPasswordCode("reader@example.com", "123456", Duration.ofMinutes(10), Language.of(null));

        assertThat(sender.subject()).isEqualTo("Mã xác nhận đổi mật khẩu AOV");
        assertThat(sender.body()).isEqualTo("Mã xác nhận đổi mật khẩu tài khoản AOV của bạn là:\n\n123456\n\n"
                + "Mã hết hạn sau 10 phút. Nếu bạn không yêu cầu đổi mật khẩu, hãy bỏ qua email này và cân nhắc "
                + "đăng xuất các thiết bị khác trong cài đặt tài khoản.");
    }

    @Test
    void thePasswordCodeMailIsWrittenInTheLanguageOfTheRequest() throws Exception {
        mail.sendPasswordCode("reader@example.com", "123456", Duration.ofMinutes(10), Language.of("en-US"));

        assertThat(sender.subject()).isEqualTo("Your AOV password change code");
        assertThat(sender.body()).isEqualTo("Your code to change the password of your AOV account is:\n\n123456\n\n"
                + "It expires in 10 minutes. If you did not ask to change your password, ignore this email and "
                + "consider signing out other devices in your account settings.");
    }

    @Test
    void theChangedPasswordNoticeFollowsTheLanguageOfTheRequest() throws Exception {
        mail.sendPasswordChanged("reader@example.com", Language.VI);
        mail.sendPasswordChanged("reader@example.com", Language.EN);

        assertThat(sender.sent).hasSize(2);
        assertThat(sender.sent.getFirst().getSubject()).isEqualTo("Mật khẩu AOV đã được đổi");
        assertThat(sender.subject()).isEqualTo("Your AOV password was changed");
        assertThat(sender.body()).isEqualTo("The password of your AOV account was just changed. If this was not "
                + "you, reset your password from the sign-in page and sign out other devices.");
    }

    @Test
    void everyTemplateFillsAllOfItsPlaceholdersInEveryLanguage() {
        var templates = new AccountMailTemplates();
        var values = Map.of("product", "AOV", "code", "123456", "minutes", "10");

        for (String name : List.of(AccountMailTemplates.PASSWORD_CODE, AccountMailTemplates.PASSWORD_CHANGED)) {
            for (Language language : Language.values()) {
                var written = templates.render(name, language, values);
                assertThat(written.subject() + written.body()).as("%s in %s", name, language)
                        .doesNotContain("{", "}").contains("AOV");
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<JavaMailSender> provider(JavaMailSender sender) {
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(sender);
        return provider;
    }

    /** A configured sender that keeps the messages instead of opening an SMTP connection. */
    private static final class CapturingSender extends JavaMailSenderImpl {
        private final List<MimeMessage> sent = new ArrayList<>();

        private CapturingSender() {
            setHost("smtp.example.com");
        }

        @Override
        public void send(MimeMessage message) {
            sent.add(message);
        }

        private String subject() throws MessagingException {
            return sent.getLast().getSubject();
        }

        private String body() throws MessagingException, IOException {
            return (String) sent.getLast().getContent();
        }
    }
}
