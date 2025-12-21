# Simple helper to add, commit, and push changes to GitHub (PowerShell)
param(
    [string]$Message = "Update: automated commit"
)

Write-Host "Staging changes..."
git add -A

Write-Host "Committing with message: $Message"
git commit -m "$Message"

Write-Host "Pushing to origin (current branch)..."
git push

Write-Host "Done. If push fails, ensure you have remote configured and authentication set up."