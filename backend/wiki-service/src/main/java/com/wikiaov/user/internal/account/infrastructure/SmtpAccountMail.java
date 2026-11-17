package com.wikiaov.user.internal.account.infrastructure;

import com.wikiaov.platform.ApiException;
import com.wikiaov.user.internal.account.application.port.AccountMail;
import com.wikiaov.user.internal.application.UserErrorCode;
import jakarta.mail.MessagingException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
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
 * messages. Codes and addresses are never logged.
 */
@Component
@EnableConfigurationProperties(SmtpAccountMail.Properties.class)
class SmtpAccountMail implements AccountMail {
    private static final Logger log = LoggerFactory.getLogger(SmtpAccountMail.class);
    private final ObjectProvider<JavaMailSender> sender;
    private final Properties properties;

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
        String product = properties.productName();
        Message message = language == Language.EN
                ? new Message("Your " + product + " password change code",
                        "Your code to change the password of your " + product + " account is:\n\n" + code
                                + "\n\nIt expires in " + minutes + " minutes. If you did not ask to change your "
                                + "password, ignore this email and consider signing out other devices in your "
                                + "account settings.")
                : new Message("Mã xác nhận đổi mật khẩu " + product,
                        "Mã xác nhận đổi mật khẩu tài khoản " + product
                                + " của bạn là:\n\n" + code + "\n\nMã hết hạn sau "
                                + minutes + " phút. Nếu bạn không yêu cầu đổi "
                                + "mật khẩu, hãy bỏ qua email này và cân nhắc "
                                + "đăng xuất các thiết bị khác trong cài "
                                + "đặt tài khoản.");
        send(to, message);
    }

    @Override
    public void sendPasswordChanged(String to, Language language) {
        String product = properties.productName();
        Message message = language == Language.EN
                ? new Message("Your " + product + " password was changed",
                        "The password of your " + product + " account was just changed. If this was not you, "
                                + "reset your password from the sign-in page and sign out other devices.")
                : new Message("Mật khẩu " + product + " đã được đổi",
                        "Mật khẩu tài khoản " + product + " của bạn vừa được "
                                + "đổi. Nếu không phải bạn, hãy đặt lại "
                                + "mật khẩu từ trang đăng nhập và đăng xuất "
                                + "các thiết bị khác.");
        send(to, message);
    }

    private void send(String to, Message message) {
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

    private record Message(
            String subject,
            String body
    ) {
    }
}
