# =====================================================
# Netkeiba Scraper v2 Simple Command Runner
# =====================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ConfigPath = "config\execution-schedule.json"
)

# =====================================================
# Global Variables
# =====================================================
$script:Config = $null
$script:LogFile = $null
$script:StartTime = Get-Date

# =====================================================
# Log Functions
# =====================================================
function Write-ExecutionLog {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "DEBUG", "SUCCESS")]
        [string]$Level = "INFO",
        [switch]$Console = $true
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    if ($Console -or $VerboseOutput) {
        $color = switch ($Level) {
            "ERROR" { "Red" }
            "WARN"  { "Yellow" }
            "DEBUG" { "Gray" }
            "SUCCESS" { "Green" }
            default { "White" }
        }
        Write-Host $logEntry -ForegroundColor $color
    }
    
    if ($script:LogFile) {
        Add-Content -Path $script:LogFile -Value $logEntry -ErrorAction SilentlyContinue
    }
}

# =====================================================
# Configuration Functions
# =====================================================
function Import-Config {
    param([string]$ConfigPath)
    
    try {
        if (-not (Test-Path $ConfigPath)) {
            throw "Configuration file not found: $ConfigPath"
        }
        
        $configContent = Get-Content -Path $ConfigPath -Raw -Encoding UTF8
        $config = $configContent | ConvertFrom-Json
        
        Write-ExecutionLog "Configuration loaded: $ConfigPath" -Level "INFO"
        return $config
    }
    catch {
        Write-ExecutionLog "Configuration load error: $($_.Exception.Message)" -Level "ERROR"
        throw
    }
}

# =====================================================
# Command Execution Functions
# =====================================================
function Invoke-Command {
    param([object]$Config)
    
    $startTime = Get-Date
    $success = $false
    $errorMessage = ""
    
    try {
        # Build command from config
        $command = $Config.command
        $args = @()
        
        foreach ($key in $Config.args.PSObject.Properties.Name) {
            $value = $Config.args.$key
            $args += "--$key=$value"
        }
        
        $commandLine = "$command $($args -join ' ')"
        Write-ExecutionLog "Executing: $commandLine" -Level "INFO"
        
        # Create logs directory if it doesn't exist
        if (-not (Test-Path "logs")) {
            New-Item -ItemType Directory -Path "logs" -Force | Out-Null
        }
        
        # Execute command
        $workingDir = Get-Location
        $cmdArgs = "/c cd /d `"$workingDir`" && $commandLine"
        $process = Start-Process -FilePath "cmd" -ArgumentList $cmdArgs -Wait -PassThru -NoNewWindow -RedirectStandardOutput "logs\output.log" -RedirectStandardError "logs\error.log"
        
        if ($process.ExitCode -eq 0) {
            Write-ExecutionLog "Command execution successful" -Level "SUCCESS"
        } else {
            Write-ExecutionLog "Command execution failed (ExitCode: $($process.ExitCode))" -Level "ERROR"
            $errorMessage = "ExitCode: $($process.ExitCode)"
        }
        
        $success = $process.ExitCode -eq 0
    }
    catch {
        $errorMessage = $_.Exception.Message
        Write-ExecutionLog "Command execution error: $errorMessage" -Level "ERROR"
    }
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-ExecutionLog "Command execution completed (Duration: $($duration.TotalSeconds.ToString('F1'))s)" -Level "INFO"
    
    return $success
}

# =====================================================
# Main Function
# =====================================================
function Main {
    try {
        Write-ExecutionLog "========================================" -Level "INFO"
        Write-ExecutionLog "Netkeiba Scraper v2 Command Runner Started" -Level "INFO"
        Write-ExecutionLog "========================================" -Level "INFO"
        Write-ExecutionLog "Execution Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Level "INFO"
        
        # Load configuration
        $script:Config = Import-Config -ConfigPath $ConfigPath
        
        # Setup log file
        if ($script:Config.log_path) {
            $logDir = Split-Path -Path $script:Config.log_path -Parent
            if ($logDir -and -not (Test-Path $logDir)) {
                New-Item -ItemType Directory -Path $logDir -Force | Out-Null
            }
            $script:LogFile = Join-Path (Get-Location) $script:Config.log_path
        }
        
        # Execute command
        $success = Invoke-Command -Config $script:Config
        
        $duration = (Get-Date) - $script:StartTime
        Write-ExecutionLog "========================================" -Level "INFO"
        Write-ExecutionLog "Command Runner Completed (Total Duration: $($duration.TotalSeconds.ToString('F1'))s)" -Level "INFO"
        Write-ExecutionLog "========================================" -Level "INFO"
        
        # Exit code
        exit $(if ($success) { 0 } else { 1 })
    }
    catch {
        Write-ExecutionLog "Fatal error occurred: $($_.Exception.Message)" -Level "ERROR"
        Write-ExecutionLog "Stack trace: $($_.ScriptStackTrace)" -Level "DEBUG"
        
        exit 1
    }
}

# =====================================================
# Execute
# =====================================================
Main