<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign isWiki = (client.clientId!"") == "aov-wiki">
<#assign product = isWiki?then("Wiki", "Stream")>
<#assign brand = isWiki?then("wiki", "stream")>
<#assign logo = isWiki?then("mole.png", "owl.svg")>
<!doctype html>
<html lang="${lang}" dir="<#if realm.internationalizationEnabled && locale.rtl>rtl<#else>ltr</#if>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="${isWiki?then('#211b15', '#171b2c')}">
  <title>${msg("aovAccountTitle")} · AOV ${product}</title>
  <link rel="icon" href="${url.resourcesPath}/img/${logo}">
  <link rel="stylesheet" href="${url.resourcesPath}/css/aov-login.css">
  <script type="importmap">{"imports":{"rfc4648":"${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"}}</script>
  <#if scripts??><#list scripts as script><script src="${script}" defer></script></#list></#if>
  <script type="module" src="${url.resourcesPath}/js/aov-login.js"></script>
</head>
<body class="aov-auth ${bodyClass}" data-brand="${brand}" data-page-id="login-${pageId}"
      data-session-poll-url="${url.ssoLoginInOtherTabsUrl}"
      <#if authenticationSession??>data-auth-session="${authenticationSession.authSessionIdHash}"</#if>>
  <main class="aov-layout">
    <aside class="aov-story" aria-label="AOV ${product}">
      <div class="aov-story-top">
        <span class="aov-brand"><img src="${url.resourcesPath}/img/${logo}" alt="" width="40" height="40">
          <span class="aov-wordmark"><b>AOV</b><span>${product}</span></span>
        </span>
        <span class="aov-account-label">${msg("aovAccountTitle")}</span>
      </div>
      <div class="aov-story-content">
        <div class="aov-mascot-frame"><img src="${url.resourcesPath}/img/${logo}" alt="" width="152" height="152"></div>
        <p class="aov-eyebrow">${msg("aovSharedAccount")}</p>
        <h2>${msg(isWiki?then("aovWikiHeadline", "aovStreamHeadline"))}</h2>
        <p class="aov-story-description">${msg(isWiki?then("aovWikiDescription", "aovStreamDescription"))}</p>
      </div>
      <div class="aov-story-footer"><span>AOV Wiki</span><i aria-hidden="true"></i><span>AOV Stream</span></div>
    </aside>
    <section class="aov-form-panel" aria-labelledby="kc-page-title">
      <div class="aov-toolbar">
        <#if client.baseUrl?has_content><a class="aov-back" href="${client.baseUrl}"><span aria-hidden="true">←</span> ${msg("aovBackToApp", product)}</a></#if>
        <#if realm.internationalizationEnabled && locale.supported?size gt 1>
          <details class="aov-locale"><summary>${locale.current}</summary><nav aria-label="${msg('languages')}">
            <#list locale.supported as language><a href="${language.url}" lang="${language.languageTag}">${language.label}</a></#list>
          </nav></details>
        </#if>
      </div>
      <div class="aov-form-card">
        <div class="aov-mobile-brand aov-brand"><img src="${url.resourcesPath}/img/${logo}" alt="" width="44" height="44"><span class="aov-wordmark"><b>AOV</b><span>${product}</span></span></div>
        <header class="aov-form-header">
          <p class="aov-eyebrow">AOV ${product}</p>
          <h1 id="kc-page-title"><#nested "header"></h1>
          <p class="aov-form-intro">${msg("aovContinue", product)}</p>
          <#if displayRequiredFields><p class="aov-required"><span aria-hidden="true">*</span> ${msg("requiredFields")}</p></#if>
        </header>
        <#if auth?has_content && auth.showUsername() && !auth.showResetCredentials()>
          <#nested "show-username">
          <div id="kc-username" class="aov-username"><span id="kc-attempted-username">${auth.attemptedUsername}</span><a id="reset-login" href="${url.loginRestartFlowUrl}">${msg("aovChangeAccount")}</a></div>
        </#if>
        <div id="kc-content"><div id="kc-content-wrapper">
          <#if displayMessage && message?has_content && (message.type != "warning" || !isAppInitiatedAction??)>
            <div class="aov-message" data-kind="${message.type}" role="<#if message.type == 'error'>alert<#else>status</#if>">${kcSanitize(message.summary)?no_esc}</div>
          </#if>
          <#nested "form">
          <#if auth?has_content && auth.showTryAnotherWayLink()>
            <form action="${url.loginAction}" method="post" class="aov-alternative"><input type="hidden" name="tryAnotherWay" value="on"><button type="submit" class="aov-text-button">${msg("doTryAnotherWay")}</button></form>
          </#if>
          <#nested "socialProviders">
          <#if displayInfo><div id="kc-info"><div id="kc-info-wrapper"><#nested "info"></div></div></#if>
        </div></div>
        <p class="aov-form-footer">${msg("aovAccountNote")}</p>
      </div>
    </section>
  </main>
</body>
</html>
</#macro>
