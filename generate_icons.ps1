Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile("c:\Mova\assets\mova-logo.png")

# 1. Ícone Fundo Branco com logo azul original
$bmpWhite = New-Object System.Drawing.Bitmap(1024, 1024)
$gW = [System.Drawing.Graphics]::FromImage($bmpWhite)
$gW.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gW.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$gW.Clear([System.Drawing.Color]::White)

$w = 750
$h = [int](750 * ($src.Height / $src.Width))
$xPos = [int]((1024 - $w) / 2)
$yPos = [int]((1024 - $h) / 2)

$gW.DrawImage($src, $xPos, $yPos, $w, $h)
$bmpWhite.Save("c:\Mova\assets\icon-white.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gW.Dispose()
$bmpWhite.Dispose()

# 2. Logo Branco
$whiteLogo = New-Object System.Drawing.Bitmap($src.Width, $src.Height)
for ($col = 0; $col -lt $src.Width; $col++) {
    for ($row = 0; $row -lt $src.Height; $row++) {
        $pixel = $src.GetPixel($col, $row)
        if ($pixel.A -gt 0) {
            $whiteLogo.SetPixel($col, $row, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
        }
    }
}
$whiteLogo.Save("c:\Mova\assets\mova-logo-white.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 3. Ícone Fundo Azul Escuro (#071661) com logo branco
$bmpDark = New-Object System.Drawing.Bitmap(1024, 1024)
$gD = [System.Drawing.Graphics]::FromImage($bmpDark)
$gD.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gD.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$navyColor = [System.Drawing.Color]::FromArgb(255, 7, 22, 97)
$gD.Clear($navyColor)

$gD.DrawImage($whiteLogo, $xPos, $yPos, $w, $h)
$bmpDark.Save("c:\Mova\assets\icon-dark.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gD.Dispose()
$bmpDark.Dispose()

$whiteLogo.Dispose()
$src.Dispose()

Write-Output "ALL_ICONS_READY"
