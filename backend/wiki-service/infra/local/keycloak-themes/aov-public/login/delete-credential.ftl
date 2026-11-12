<#-- Same form as the Keycloak base theme; an unnamed authenticator shows its type name instead of "otp" (ADR-028). -->
<#import "template.ftl" as layout>
<#assign credentialName = (credentialLabel == "otp")?then(msg("otp-display-name"), (credentialLabel == "recovery-authn-codes")?then(msg("recovery-authn-codes-display-name"), credentialLabel))>
<@layout.registrationLayout displayMessage=false; section>
    <#if section = "header">
        ${msg("deleteCredentialTitle", credentialName)}
    <#elseif section = "form">
    <div id="kc-delete-text">
        ${msg("deleteCredentialMessage", credentialName)}
    </div>
    <form class="form-actions" action="${url.loginAction}" method="POST">
        <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonLargeClass!}" name="accept" id="kc-accept" type="submit" value="${msg("doConfirmDelete")}"/>
        <input class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonLargeClass!}" name="cancel-aia" value="${msg("doCancel")}" id="kc-decline" type="submit" />
    </form>
    <div class="clearfix"></div>
    </#if>
</@layout.registrationLayout>
