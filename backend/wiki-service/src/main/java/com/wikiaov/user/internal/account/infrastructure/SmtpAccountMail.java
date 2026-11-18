package com.wikiaov.user.internal.account.infrastructure;

import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.account.application.port.AccountMail;
import com.wikiaov.user.internal.account.infrastructure.AccountMailTemplates.Mail;
import com.wikiaov.user.internal.application.UserErrorCode;
import jakarta.mail.MessagingException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * Sends account security email over SMTP ({@code spring.mail.*}). Any SMTP provider works; locally Mailpit catches
 * messages. Subjects and bodies come from the per-language templates of {@link AccountMailTemplates}. Codes and
 * addresses are never logged.
 */
@Component
@EnableConfigurationProperties(SmtpAccountMail.Properties.class)
class SmtpAccountMail implements AccountMail {
    private static final Logger log = LoggerFactory.getLogger(SmtpAccountMail.class);
    private final ObjectProvider<JavaMailSender> sender;
    private final Properties properties;
    private final AccountMailTemplates templates = new AccountMailTemplates();

    SmtpAccountMail(ObjectProvider<JavaMailSender> sender, Properties properties) {
        this.sender = sender;
        this.properties = properties;
    }

    /**
     * @param from        sender, e.g. {@code AOV <no-reply@example.com>}; blank disables account email
     * @param productName name shown in subjects and bodies
     */
    @ConfigurationProperties("wiki.account.mail")
    record Properties(
            @DefaultValue("") String from,
            @DefaultValue("AOV") String productName
    ) {
    }

    @Override
    public boolean available() {
        return configured(sender.getIfAvailable());
    }

    @Override
    public void sendPasswordCode(String to, String code, Duration lifetime, Language language) {
        long minutes = Math.max(1, lifetime.toMinutes());
        Mail mail = templates.render(AccountMailTemplates.PASSWORD_CODE, language,
                Map.of("product", properties.productName(), "code", code, "minutes", Long.toString(minutes)));
        send(to, mail);
    }

    @Override
    public void sendPasswordChanged(String to, Language language) {
        Mail mail = templates.render(AccountMailTemplates.PASSWORD_CHANGED, language,
                Map.of("product", properties.productName()));
        send(to, mail);
    }

    private void send(String to, Mail message) {
        JavaMailSender mail = sender.getIfAvailable();
        if (!configured(mail)) {
            throw unavailable(null);
        }

        try {
            var mime = mail.createMimeMessage();
            var helper = new MimeMessageHelper(mime, false, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.from());
            helper.setTo(to);
            helper.setSubject(message.subject());
            helper.setText(message.body(), false);
            mail.send(mime);
        } catch (MailException | MessagingException exception) {
            log.warn("Account email could not be sent: {}", exception.getClass().getSimpleName());
            throw unavailable(exception);
        }
    }

    /** An empty {@code spring.mail.host} still creates a sender, so the host is checked too. */
    private boolean configured(JavaMailSender mail) {
        return mail != null && !properties.from().isBlank()
                && !(mail instanceof JavaMailSenderImpl impl && (impl.getHost() == null || impl.getHost().isBlank()));
    }

    private static ApiException unavailable(Exception cause) {
        return new ApiException(UserErrorCode.USER_MAIL_UNAVAILABLE, "Email could not be sent.", cause);
    }
}
