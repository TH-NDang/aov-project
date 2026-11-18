<#-- Frame of the Keycloak pages Admin can reach during Google sign-in (two-step code, recovery code, choice of method,
     account linking). It copies the Admin sign-in dialog; the forms themselves stay Keycloak's. -->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign page = pageId!"">
<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#121215">
  <meta name="robots" content="noindex, nofollow">
  <title>${msg("aovAdminTitle")} · AOV Admin</title>
  <link rel="icon" href="${url.resourcesPath}/img/aov-mark.svg">
  <link rel="stylesheet" href="${url.resourcesPath}/css/aov-admin.css">
  <script type="importmap">{"imports":{"rfc4648":"${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"}}</script>
  <#if scripts??><#list scripts as script><script src="${script}" defer></script></#list></#if>
  <script type="module" src="${url.resourcesPath}/js/aov-admin.js"></script>
</head>
<body class="aov-admin ${bodyClass}" data-page-id="${page}"
      data-session-poll-url="${url.ssoLoginInOtherTabsUrl}"
      <#if authenticationSession??>data-auth-session="${authenticationSession.authSessionIdHash}"</#if>>
  <main class="aov-admin-page">
    <section class="aov-admin-card" aria-labelledby="kc-page-title">
      <div class="aov-admin-brand">
        <img src="${url.resourcesPath}/img/aov-mark.svg" alt="" width="44" height="44">
        <span class="aov-admin-wordmark"><b>AOV</b> <span>Admin</span></span>
      </div>
      <header class="aov-admin-header">
        <#if page == "login-otp">
          <h1 id="kc-page-title">${msg("aovAdminOtpTitle")}</h1>
          <p>${msg("aovAdminOtpIntro")}</p>
        <#elseif page == "login-recovery-authn-code-input">
          <h1 id="kc-page-title"><#nested "header"></h1>
          <p>${msg("aovAdminRecoveryIntro")}</p>
        <#elseif page == "select-authenticator">
          <h1 id="kc-page-title"><#nested "header"></h1>
          <p>${msg("aovAdminChooseIntro")}</p>
        <#else>
          <h1 id="kc-page-title"><#nested "header"></h1>
        </#if>
        <#if displayRequiredFields><p class="aov-required">${msg("requiredFields")}</p></#if>
      </header>
      <#if auth?has_content && auth.showUsername() && !auth.showResetCredentials()>
        <#nested "show-username">
        <div id="kc-username" class="aov-admin-account">
          <span><span class="aov-admin-account-label">${msg("aovAdminAccount")}</span>
            <span id="kc-attempted-username">${auth.attemptedUsername}</span></span>
          <a id="reset-login" href="${url.loginRestartFlowUrl}">${msg("aovAdminChangeAccount")}</a>
        </div>
      </#if>
      <div id="kc-content"><div id="kc-content-wrapper">
        <#if displayMessage && message?has_content && (message.type != "warning" || !isAppInitiatedAction??)>
          <div class="aov-message" data-kind="${message.type}" role="<#if message.type == 'error'>alert<#else>status</#if>">${kcSanitize(message.summary)?no_esc}</div>
        </#if>
        <#nested "form">
        <#if auth?has_content && auth.showTryAnotherWayLink()>
          <form action="${url.loginAction}" method="post" class="aov-alternative">
            <input type="hidden" name="tryAnotherWay" value="on">
            <button type="submit" class="aov-text-button">${msg("doTryAnotherWay")}</button>
          </form>
        </#if>
        <#nested "socialProviders">
        <#if displayInfo><div id="kc-info"><div id="kc-info-wrapper"><#nested "info"></div></div></#if>
      </div></div>
      <p class="aov-admin-footer">${msg("aovAdminNote")}</p>
    </section>
  </main>
</body>
</html>
</#macro>
