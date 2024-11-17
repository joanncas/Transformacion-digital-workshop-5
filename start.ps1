# Function to check if a command exists
function Test-CommandExists {
    param ($command)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    try { if (Get-Command $command) { return $true } }
    catch { return $false }
    finally { $ErrorActionPreference = $oldPreference }
}

# Check and install Git
$gitVersion = git --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Git is already installed: $gitVersion"
} else {
    Write-Host "Git is not installed. Installing Git..."
    
    # Download the Git installer
    $installerUrl = "https://github.com/git-for-windows/git/releases/download/v2.43.0.windows.1/Git-2.43.0-64-bit.exe"
    $installerPath = "$env:TEMP\GitInstaller.exe"
    
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath
    
    # Install Git silently
    Start-Process -FilePath $installerPath -Args "/SILENT /NORESTART" -Wait
    
    # Clean up installer
    Remove-Item $installerPath
    
    Write-Host "Git has been installed successfully!"
}

# Check and install Node.js
if (!(Test-CommandExists node)) {
    Write-Host "Node.js is not installed. Installing Node.js..."
    
    # Download Node.js installer
    $nodeVersion = "20.11.1" # LTS version
    $nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-x64.msi"
    $nodeInstallerPath = "$env:TEMP\NodeInstaller.msi"
    
    # Download the installer
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstallerPath
    
    # Install Node.js silently
    Start-Process msiexec.exe -Args "/i `"$nodeInstallerPath`" /quiet /norestart" -Wait
    
    # Clean up installer
    Remove-Item $nodeInstallerPath
    
    # Refresh environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    Write-Host "Node.js has been installed successfully!"
    
    # Verify installation
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "Node.js version: $nodeVersion"
    Write-Host "npm version: $npmVersion"
} else {
    $nodeVersion = node --version
    Write-Host "Node.js is already installed: $nodeVersion"
}

# Set the repository URL and destination paths
$repoUrl = "https://github.com/username/repository.git"  # Replace with your repository URL
$destinationPath = "C:\Projects\repository"              # Replace with your desired path

# Create the destination directory if it doesn't exist
if (!(Test-Path $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath
}

# Clone the repository
Write-Host "Cloning repository from $repoUrl to $destinationPath..."
git clone $repoUrl $destinationPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "Repository cloned successfully!"
} else {
    Write-Host "Failed to clone repository. Please check the URL and try again."
    exit 1
}

# Define the paths for the two npm projects
$project1Path = "C:\Projects\repository\project1"  # Replace with your first project path
$project2Path = "C:\Projects\repository\project2"  # Replace with your second project path

# Function to install npm dependencies
function Install-NpmDependencies {
    param (
        [string]$projectPath,
        [string]$projectName
    )
    
    Write-Host "Installing dependencies for $projectName..."
    
    if (!(Test-Path $projectPath)) {
        Write-Host "Error: Project path $projectPath does not exist!"
        exit 1
    }
    
    Set-Location $projectPath
    
    # Check if package.json exists
    if (!(Test-Path "package.json")) {
        Write-Host "Error: package.json not found in $projectPath"
        exit 1
    }
    
    # Run npm install
    $processInfo = Start-Process -FilePath "npm" -ArgumentList "install" -Wait -NoNewWindow -PassThru
    if ($processInfo.ExitCode -ne 0) {
        Write-Host "Error: npm install failed for $projectName"
        exit 1
    }
    
    Write-Host "Successfully installed dependencies for $projectName"
}

# Function to start npm process
function Start-NpmProcess {
    param (
        [string]$projectPath,
        [string]$scriptName,
        [string]$windowTitle
    )
    
    $npmCmd = "cd '$projectPath' && npm run $scriptName"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $npmCmd -WindowStyle Normal -WorkingDirectory $projectPath
}

# Install dependencies for both projects
Write-Host "Starting dependency installation..."
Install-NpmDependencies -projectPath $project1Path -projectName "Project 1"
Install-NpmDependencies -projectPath $project2Path -projectName "Project 2"
Write-Host "All dependencies installed successfully!"

# Start both npm processes in separate windows
Write-Host "Starting npm processes..."

# Start first npm process (e.g., frontend)
Start-NpmProcess -projectPath $project1Path -scriptName "start" -windowTitle "Frontend Process"

# Wait a few seconds before starting the second process
Start-Sleep -Seconds 3

# Start second npm process (e.g., backend)
Start-NpmProcess -projectPath $project2Path -scriptName "dev" -windowTitle "Backend Process"

Write-Host "Both npm processes have been started in separate windows."