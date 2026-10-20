param(
    [string]$ApiBase = 'http://localhost:8080/api/wiki/v1',
    [string]$RulesetCode = 'aov-standard',
    [Parameter(Mandatory)][string]$PatchCode,
    [string]$ObservationNote = 'Record the initial arcana baseline from source collected on 2026-09-23; not a gameplay change.',
    [string]$ReportPath = '.local-state/arcana-publication-result.json',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
if (!$env:WIKI_API_TOKEN) { throw 'Set WIKI_API_TOKEN to an existing authorized access token.' }
$headers = @{ Authorization = "Bearer $($env:WIKI_API_TOKEN)" }
function Request([string]$Path, [string]$Method = 'Get', $Body = $null) {
    $arguments = @{ Uri = "$ApiBase$Path"; Method = $Method; Headers = $headers; TimeoutSec = 30 }
    if ($null -ne $Body) {
        $arguments.ContentType = 'application/json; charset=utf-8'
        $arguments.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 100 -Compress))
    }
    Invoke-RestMethod @arguments
}
$actor = Request '/admin/me'
if ('arcana:write' -notin $actor.capabilities -or 'arcana:publish' -notin $actor.capabilities) {
    throw 'The caller needs existing arcana:write and arcana:publish capabilities.'
}
$allRulesets = Request '/admin/rulesets'
$ruleset = @($allRulesets | Where-Object code -eq $RulesetCode)
if ($ruleset.Count -ne 1) { throw 'Exactly one matching ruleset is required.' }
$ruleset = $ruleset[0]
$overview = Request '/admin/publication-overview'
$patch = @($overview.variants | Where-Object { $_.rulesetId -eq $ruleset.id -and $_.patchCode -eq $PatchCode -and $_.status -eq 'PUBLISHED' })
if ($patch.Count -ne 1) { throw 'Exactly one published observation patch is required in the selected ruleset.' }
$patch = $patch[0]
$entries = [Collections.Generic.List[object]]::new()
for ($page = 0; ; $page++) {
    $slice = Request "/admin/arcana?rulesetId=$($ruleset.id)&page=$page&size=100"
    foreach ($entry in $slice.items) { $entries.Add($entry) }
    if (!$slice.items.Count -or $entries.Count -ge $slice.totalElements) { break }
}
$results = [Collections.Generic.List[object]]::new()
foreach ($entry in $entries) {
    $revision = $entry.revision
    $result = [ordered]@{ code = $entry.code; id = $entry.id; revisionId = $revision.id; status = ''; missingFields = @() }
    if ($revision.state -eq 'PUBLISHED') { $result.status = 'ALREADY_PUBLISHED' }
    elseif ($revision.state -ne 'DRAFT' -or $revision.cause -ne 'DATA_BASELINE' -or $revision.sourceRevisionId) {
        $result.status = 'NOT_INDEPENDENT_BASELINE'
    }
    elseif ($revision.effectiveFromPatchVariantId -and $revision.effectiveFromPatchVariantId -ne $patch.id) {
        $result.status = 'DIFFERENT_OBSERVATION_CONTEXT'
    }
    else {
        $missing = @($entry.missingFields | Where-Object { $_ -ne 'effectiveFromPatchVariantId' })
        if ($missing.Count) { $result.status = 'INCOMPLETE'; $result.missingFields = $missing }
        elseif (!$Apply) { $result.status = 'READY' }
        else {
            try {
                if (!$revision.effectiveFromPatchVariantId) {
                    $entry = Request "/admin/arcana/$($entry.id)/drafts/$($revision.id)" 'Put' @{
                        expectedVersion = $revision.version
                        content = $entry.content
                        effectiveFromPatchVariantId = $patch.id
                        changeNote = $ObservationNote
                    }
                }
                $published = Request "/admin/arcana/$($entry.id)/drafts/$($revision.id)/publish" 'Post' @{
                    expectedVersion = $entry.revision.version
                    changeNote = $ObservationNote
                }
                if ($published.revision.state -ne 'PUBLISHED' -or $published.revision.cause -ne 'DATA_BASELINE') {
                    throw 'Publication did not return the expected baseline state.'
                }
                $result.status = 'PUBLISHED'
            } catch {
                $result.status = 'FAILED'
                $result.error = $_.Exception.Message
            }
        }
    }
    $results.Add([pscustomobject]$result)
}
$report = [ordered]@{
    applied = [bool]$Apply; rulesetCode = $RulesetCode; patchCode = $PatchCode; patchVariantId = $patch.id
    observationNote = $ObservationNote; recordedAt = [DateTimeOffset]::UtcNow.ToString('o'); results = $results.ToArray()
}
$parent = Split-Path -Parent $ReportPath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$report | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $ReportPath
$results | Group-Object status | Select-Object Name, Count | Format-Table -AutoSize
$results | Where-Object { $_.status -in @('INCOMPLETE','FAILED','DIFFERENT_OBSERVATION_CONTEXT','NOT_INDEPENDENT_BASELINE') } | ConvertTo-Json -Depth 5
if (@($results | Where-Object status -eq 'FAILED').Count) { exit 1 }
