$root = "C:\Users\hp\Desktop\CALQULUS-PMS"
Set-Location $root

$doubleQuoteFiles = @(
  "src\features\settings\pages\Settings.tsx",
  "src\features\landlord\pages\LandlordSettings.tsx"
)
foreach ($f in $doubleQuoteFiles) {
  (Get-Content $f -Raw) -replace 'import DashboardSectionHeader from "@/features/dashboard/components/DashboardSectionHeader";', 'import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";' | Set-Content $f -NoNewline
}

$tp = "src\features\tenant-portal\pages\TenantProfile.tsx"
(Get-Content $tp -Raw) -replace "import DashboardSectionHeader from '@/features/dashboard/components/DashboardSectionHeader';", "import { DashboardSectionHeader } from '@/features/dashboard/components/DashboardSectionHeader';" | Set-Content $tp -NoNewline

$deadFolders = @(
  "supabase\functions\initiate-mpesa-payment",
  "supabase\functions\initiate-manager-mpesa-payment",
  "supabase\functions\initiate-subscription-mpesa",
  "supabase\functions\process-commission",
  "supabase\functions\accept-tenant-invite"
)
foreach ($d in $deadFolders) {
  if (Test-Path $d) { Remove-Item -Recurse -Force $d; Write-Host "Deleted $d" }
}

Write-Host "Done. Run 'git status' to review."
