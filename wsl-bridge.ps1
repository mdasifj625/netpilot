# wsl-bridge.ps1
# Run this script in Windows PowerShell as an Administrator to set up WSL 2 Port Proxying.

$ErrorActionPreference = "Stop"

# 1. Fetch the default WSL IP address
Write-Host "Querying WSL 2 instance IP..." -ForegroundColor Cyan
try {
    $wslIpRaw = wsl hostname -I
    $wslIp = [regex]::match($wslIpRaw, '\d+\.\d+\.\d+\.\d+').Value
    if (-not $wslIp) {
        throw "Could not extract a valid IPv4 address from WSL."
    }
    Write-Host "Found WSL IP: $wslIp" -ForegroundColor Green
} catch {
    Write-Error "Failed to retrieve WSL IP. Make sure WSL is running and default distro is set."
    Exit 1
}

# 2. Reset and set up netsh port proxy
Write-Host "Configuring Netsh port forwarding on port 8081..." -ForegroundColor Cyan
try {
    # Delete existing mapping on port 8081
    netsh interface portproxy delete v4tov4 listenport=8081 listenaddress=0.0.0.0 | Out-Null
} catch {
    # Ignore if it didn't exist
}

try {
    # Add new proxy mapping
    netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=$wslIp
    Write-Host "Portproxy successfully established: [Windows Host]:8081 -> [WSL IP $wslIp]:8081" -ForegroundColor Green
} catch {
    Write-Error "Failed to configure netsh portproxy. Please make sure you are running PowerShell as Administrator."
    Exit 1
}

# 3. Add Firewall Rule
Write-Host "Verifying Windows Inbound Firewall rules..." -ForegroundColor Cyan
$ruleName = "ExpoMetroBundler"
$ruleExists = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue

if ($ruleExists) {
    Write-Host "Firewall rule 'Expo Metro Bundler' already exists." -ForegroundColor Green
} else {
    try {
        New-NetFirewallRule -Name $ruleName -DisplayName "Expo Metro Bundler" -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow | Out-Null
        Write-Host "Firewall rule 'Expo Metro Bundler' successfully created!" -ForegroundColor Green
    } catch {
        Write-Warning "Could not create firewall rule. Please check your system settings."
    }
}

Write-Host "`nWSL 2 network bridge setup complete! You can now scan the Expo QR code using your phone." -ForegroundColor Yellow
