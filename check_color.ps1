Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap("c:\Mova\assets\mova-logo.png")
$colors = @{}
for ($y = 0; $y -lt $b.Height; $y += 5) {
    for ($x = 0; $x -lt $b.Width; $x += 5) {
        $c = $b.GetPixel($x, $y)
        if ($c.A -gt 150 -and ($c.R -ne 255 -or $c.G -ne 255 -or $c.B -ne 255)) {
            $hex = "#{0:X2}{1:X2}{2:X2}" -f $c.R, $c.G, $c.B
            if (-not $colors.ContainsKey($hex)) {
                $colors[$hex] = 1
            } else {
                $colors[$hex]++
            }
        }
    }
}
$colors.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 5 | ForEach-Object {
    Write-Host "$($_.Key) count: $($_.Value)"
}
