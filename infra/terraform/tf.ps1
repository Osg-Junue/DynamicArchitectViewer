<#
.SYNOPSIS
  Runs Terraform for this stack with short-lived credentials from the local gcloud / gh CLIs.

.EXAMPLE
  ./infra/terraform/tf.ps1 init
  ./infra/terraform/tf.ps1 plan
  ./infra/terraform/tf.ps1 apply
#>
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Command,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = 'Stop'

$terraform = if ($env:TERRAFORM_EXE) { $env:TERRAFORM_EXE } else { 'C:\terraform\terraform_1.17.1_windows_386\terraform.exe' }
if (-not (Test-Path $terraform)) {
  $terraform = (Get-Command terraform -ErrorAction Stop).Source
}

# Refresh PATH so gcloud / gh installed after the shell started are found.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$env:GOOGLE_OAUTH_ACCESS_TOKEN = (gcloud auth print-access-token).Trim()
$env:GITHUB_TOKEN = (gh auth token).Trim()

Push-Location $PSScriptRoot
try {
  $extra = @($Rest | Where-Object { $_ })
  if ($Command -eq 'init') {
    # Quoted: PowerShell splits unquoted "-opt=file.ext" arguments at the dot.
    & $terraform init '-backend-config=backend.hcl' @extra
  }
  else {
    & $terraform $Command @extra
  }
  exit $LASTEXITCODE
}
finally {
  Pop-Location
  Remove-Item Env:GOOGLE_OAUTH_ACCESS_TOKEN, Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
}
