<#-- Errors of the Google sign-in that Admin starts. In the popup the page hands a stable code to the Admin window and
     closes; when popups were blocked it returns to Admin (the client's base URL) with the code in the fragment. -->
<#assign code = "UNKNOWN">
<#if message?has_content>
    <#assign summary = message.summary>
    <#if summary == msg("invalidUserMessage")>
        <#assign code = "REJECTED">
    <#elseif summary == msg("accountDisabledMessage") || summary == msg("accountTemporarilyDisabledMessage")>
        <#assign code = "ACCOUNT_DISABLED">
    <#elseif summary == msg("expiredCodeMessage") || summary == msg("expiredActionMessage") || summary == msg("loginTimeout")>
        <#assign code = "EXPIRED">
    </#if>
</#if>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="referrer" content="no-referrer">
    <title>Đăng nhập chưa hoàn tất · AOV Admin</title>
    <link rel="stylesheet" href="${url.resourcesPath}/css/aov-admin.css">
    <script src="${url.resourcesPath}/js/aov-admin-error.js" defer></script>
</head>
<body>
    <main class="aov-admin-error" data-code="${code}"<#if client?? && client.baseUrl?has_content> data-return="${client.baseUrl}"</#if>>
        <h1>Đăng nhập chưa hoàn tất</h1>
        <p>Hãy đóng cửa sổ này và thử lại từ trang quản trị.</p>
        <#if message?has_content>
            <p class="aov-admin-detail">${kcSanitize(message.summary)?no_esc}</p>
        </#if>
    </main>
</body>
</html>
