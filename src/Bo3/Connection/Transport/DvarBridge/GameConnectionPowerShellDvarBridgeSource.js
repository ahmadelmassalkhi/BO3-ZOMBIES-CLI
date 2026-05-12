/**
 * @returns {string} PowerShell source loaded into the official DVAR bridge child process.
 */
function gameConnectionPowerShellDvarBridgeSource() {
    return String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function E($v) {
    if ($null -eq $v) { $v = '' }
    [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string] $v))
}

function D($v) {
    if ($null -eq $v) { $v = '' }
    [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([string] $v))
}

function BridgeError($e) {
    if ($e -is [Management.Automation.ErrorRecord]) { $e = $e.Exception }
    while ($null -ne $e.InnerException) { $e = $e.InnerException }
    $e
}

function W($line) {
    [Console]::WriteLine($line)
    [Console]::Out.Flush()
}

try {
    $PatchDir = [Environment]::GetEnvironmentVariable('BO3_T7PATCH_DIR')
    if ([string]::IsNullOrWhiteSpace($PatchDir)) {
        throw 'Missing BO3_T7PATCH_DIR.'
    }

    $PatchDir = [IO.Path]::GetFullPath($PatchDir)
    $Cache = @{}

    function L($p) {
        $f = [IO.Path]::GetFullPath($p)
        if ($Cache.ContainsKey($f)) { return $Cache[$f] }
        $a = [Reflection.Assembly]::Load([IO.File]::ReadAllBytes($f))
        $Cache[$f] = $a
        return $a
    }

    [void] (L (Join-Path $PatchDir 'External.dll'))
    $helper = Join-Path $PatchDir 't7dwidm_protect.exe'
    if (!(Test-Path -LiteralPath $helper)) { throw "Missing t7patch helper: $helper" }

    $asm = L $helper
    $bo3 = $asm.GetType('t7dwidm_protect.Cheats.BlackOps3', $true)
    $setDvar = $bo3.GetMethod('SetDvar', [Reflection.BindingFlags] 'Public,Static')
    $isGamePresent = $bo3.GetMethod('IsGamePresent', [Reflection.BindingFlags] 'Public,Static')
    if ($null -eq $setDvar) { throw 'Missing BlackOps3.SetDvar' }

    try { [Runtime.CompilerServices.RuntimeHelpers]::PrepareMethod($setDvar.MethodHandle) } catch {}
    if ($null -ne $isGamePresent) {
        try { [Runtime.CompilerServices.RuntimeHelpers]::PrepareMethod($isGamePresent.MethodHandle) } catch {}
    }

    W 'READY	powershell-official-dvar'

    while ($null -ne ($line = [Console]::In.ReadLine())) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        $id = ''
        try {
            $parts = $line -split ([char] 9), 4
            $op = $parts[0]
            if ($parts.Length -gt 1) { $id = $parts[1] }

            if ($op -eq 'PING') {
                $present = $false
                if ($null -ne $isGamePresent) { $present = [bool] $isGamePresent.Invoke($null, @()) }
                W ('OK	' + $id + '	' + $(if ($present) { '1' } else { '0' }))
                continue
            }

            if ($op -ne 'SET' -or $parts.Length -lt 4) { throw 'Invalid bridge request.' }

            [void] $setDvar.Invoke($null, @((D $parts[2]), (D $parts[3])))
            W ('OK	' + $id)
        } catch {
            W ('ERR	' + $id + '	' + (E (BridgeError $_).Message))
        }
    }
} catch {
    W ('FATAL	' + (E (BridgeError $_).Message))
    exit 1
}
`;
}

module.exports = gameConnectionPowerShellDvarBridgeSource;
