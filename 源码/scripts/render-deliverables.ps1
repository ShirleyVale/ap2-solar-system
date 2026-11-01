param(
  [string]$OutputDirectory = "screenshots"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.Serialization

$projectRoot = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $projectRoot $OutputDirectory
$demoPath = Join-Path $projectRoot 'demo'
New-Item -ItemType Directory -Force $outPath, $demoPath | Out-Null

$planets = @(
  @{ Name='水星'; Radius=.22; Distance=3.5; Period=.24; Color='#9e958b' },
  @{ Name='金星'; Radius=.39; Distance=4.8; Period=.62; Color='#d9aa65' },
  @{ Name='地球'; Radius=.46; Distance=6.4; Period=1.0; Color='#3d82df' },
  @{ Name='火星'; Radius=.31; Distance=8.2; Period=1.88; Color='#c85e3b' },
  @{ Name='木星'; Radius=.92; Distance=11.2; Period=11.86; Color='#c9a57c' },
  @{ Name='土星'; Radius=.78; Distance=14.7; Period=29.46; Color='#d9c18d' },
  @{ Name='天王星'; Radius=.61; Distance=18.0; Period=84.0; Color='#7fd6df' },
  @{ Name='海王星'; Radius=.59; Distance=21.0; Period=164.8; Color='#3d64d8' }
)

function V3([double]$x,[double]$y,[double]$z) { return [double[]]@($x,$y,$z) }
function Sub($a,$b) { return V3 ($a[0]-$b[0]) ($a[1]-$b[1]) ($a[2]-$b[2]) }
function Dot($a,$b) { return $a[0]*$b[0]+$a[1]*$b[1]+$a[2]*$b[2] }
function Cross($a,$b) { return V3 ($a[1]*$b[2]-$a[2]*$b[1]) ($a[2]*$b[0]-$a[0]*$b[2]) ($a[0]*$b[1]-$a[1]*$b[0]) }
function Normalize($a) { $n=[Math]::Sqrt((Dot $a $a)); if($n -eq 0){return V3 0 0 0}; return V3 ($a[0]/$n) ($a[1]/$n) ($a[2]/$n) }

function New-Camera($eye,$target,[int]$width,[int]$height,[string]$projection) {
  $forward = Normalize (Sub $target $eye)
  $right = Normalize (Cross $forward (V3 0 1 0))
  $up = Cross $right $forward
  return @{ Eye=$eye; Forward=$forward; Right=$right; Up=$up; Width=$width; Height=$height; Mode=$projection; Focal=$height*1.28; Ortho=$height/46.0 }
}

function Project-Point($point,$camera) {
  $v=Sub $point $camera.Eye
  $x=Dot $v $camera.Right; $y=Dot $v $camera.Up; $depth=Dot $v $camera.Forward
  if($depth -le .2){ return $null }
  if($camera.Mode -eq 'perspective') { $scale=$camera.Focal/$depth } else { $scale=$camera.Ortho }
  return @{ X=$camera.Width/2+$x*$scale; Y=$camera.Height/2-$y*$scale; Depth=$depth; Scale=$scale }
}

function To-Color([string]$hex,[int]$alpha=255) {
  $c=[System.Drawing.ColorTranslator]::FromHtml($hex)
  return [System.Drawing.Color]::FromArgb($alpha,$c.R,$c.G,$c.B)
}

function Draw-RoundedRect($graphics,$brush,$rect,[int]$radius) {
  $path=New-Object System.Drawing.Drawing2D.GraphicsPath
  $d=$radius*2
  $path.AddArc($rect.X,$rect.Y,$d,$d,180,90); $path.AddArc($rect.Right-$d,$rect.Y,$d,$d,270,90)
  $path.AddArc($rect.Right-$d,$rect.Bottom-$d,$d,$d,0,90); $path.AddArc($rect.X,$rect.Bottom-$d,$d,$d,90,90)
  $path.CloseFigure(); $graphics.FillPath($brush,$path); $path.Dispose()
}

function Draw-TextureCircle($graphics,$image,[double]$x,[double]$y,[double]$radius,$fallback) {
  $rect=New-Object System.Drawing.RectangleF ([single]($x-$radius)),([single]($y-$radius)),([single]($radius*2)),([single]($radius*2))
  if($null -eq $image){ $b=New-Object System.Drawing.SolidBrush $fallback; $graphics.FillEllipse($b,$rect); $b.Dispose(); return }
  $oldClip=$graphics.Clip.Clone(); $clipPath=New-Object System.Drawing.Drawing2D.GraphicsPath; $clipPath.AddEllipse($rect); $graphics.SetClip($clipPath)
  $graphics.DrawImage($image,$rect)
  $graphics.Clip=$oldClip; $oldClip.Dispose(); $clipPath.Dispose()
  $shade=New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect,([System.Drawing.Color]::FromArgb(8,255,255,255)),([System.Drawing.Color]::FromArgb(125,0,0,0)),0
  $graphics.FillEllipse($shade,$rect); $shade.Dispose()
}

function Draw-Orbit($graphics,$camera,[double]$radius,$pen) {
  $points=New-Object System.Collections.Generic.List[System.Drawing.PointF]
  for($i=0;$i -le 160;$i++){
    $a=$i*[Math]::PI*2/160; $p=Project-Point (V3 ([Math]::Cos($a)*$radius) 0 ([Math]::Sin($a)*$radius)) $camera
    if($null -ne $p){$points.Add((New-Object System.Drawing.PointF ([single]$p.X),([single]$p.Y)))}
  }
  if($points.Count -gt 1){$graphics.DrawLines($pen,$points.ToArray())}
}

function New-SceneFrame([int]$width,[int]$height,[double]$time,[string]$projection,[bool]$withUi=$true) {
  $bmp=[System.Drawing.Bitmap]::new($width,$height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode='AntiAlias'; $g.TextRenderingHint='AntiAliasGridFit'
  $bg=New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0,0,$width,$height),(To-Color '#02040c'),(To-Color '#0a1028'),35
  $g.FillRectangle($bg,0,0,$width,$height); $bg.Dispose()
  $random=New-Object System.Random 240610010
  $starBrush=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150,206,222,255))
  0..260 | ForEach-Object { $sx=$random.Next(0,$width);$sy=$random.Next(0,$height);$ss=if($_%11-eq 0){2}else{1};$g.FillEllipse($starBrush,$sx,$sy,$ss,$ss) }
  $starBrush.Dispose()

  $angle=$time/10*[Math]::PI*2 + .45
  $eye=V3 ([Math]::Cos($angle)*35) (10+4*[Math]::Sin($angle*.7)) ([Math]::Sin($angle)*35)
  $camera=New-Camera $eye (V3 0 0 0) $width $height $projection
  $orbitPen=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(55,112,143,205),[single]1)
  foreach($planet in $planets){Draw-Orbit $g $camera $planet.Distance $orbitPen}
  $orbitPen.Dispose()

  $bodies=New-Object System.Collections.Generic.List[object]
  for($i=0;$i -lt $planets.Count;$i++){
    $planet=$planets[$i];$a=($time*12/$planet.Period+$i*37)*[Math]::PI/180
    $pos=V3 ([Math]::Cos($a)*$planet.Distance) 0 (-[Math]::Sin($a)*$planet.Distance)
    $pp=Project-Point $pos $camera
    if($null -ne $pp){$bodies.Add(@{Planet=$planet;Pos=$pos;P=$pp})}
    if($planet.Name -eq '地球'){
      $ma=($time*34/.0748)*[Math]::PI/180;$mx=[Math]::Cos($ma)*.92;$my=[Math]::Sin(5.14*[Math]::PI/180)*$mx;$mz=-[Math]::Sin($ma)*.92
      $mpos=V3 ($pos[0]+$mx) ($pos[1]+$my) ($pos[2]+$mz);$mp=Project-Point $mpos $camera
      if($null-ne$mp){$bodies.Add(@{Planet=@{Name='月球';Radius=.14;Color='#c9c9c7'};Pos=$mpos;P=$mp})}
    }
  }
  $bodies=$bodies | Sort-Object {$_.P.Depth} -Descending

  $sunP=Project-Point (V3 0 0 0) $camera;$sunR=[Math]::Max(4,1.65*$sunP.Scale)
  Draw-TextureCircle $g $script:sunImage $sunP.X $sunP.Y $sunR (To-Color '#ffb22e')
  $glowPen=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(80,255,180,60),[single]3);$g.DrawEllipse($glowPen,[single]($sunP.X-$sunR-2),[single]($sunP.Y-$sunR-2),[single]($sunR*2+4),[single]($sunR*2+4));$glowPen.Dispose()

  foreach($body in $bodies){
    $p=$body.P;$r=[Math]::Max(2.2,$body.Planet.Radius*$p.Scale)
    if($body.Planet.Name -eq '土星'){$ringPen=[System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150,219,197,145),[single][Math]::Max(1,$r*.25));$g.DrawEllipse($ringPen,[single]($p.X-$r*1.7),[single]($p.Y-$r*.56),[single]($r*3.4),[single]($r*1.12));$ringPen.Dispose()}
    $img=$null;if($body.Planet.Name-eq'地球'){$img=$script:earthImage}elseif($body.Planet.Name-eq'月球'){$img=$script:moonImage}
    Draw-TextureCircle $g $img $p.X $p.Y $r (To-Color $body.Planet.Color)
  }

  # Asteroid belt: deterministic points projected with the same camera.
  $asteroidBrush=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(130,165,146,118));$random=New-Object System.Random 420
  0..220|ForEach-Object{$a=$random.NextDouble()*[Math]::PI*2;$rr=9.35+$random.NextDouble()*.9;$ap=Project-Point (V3 ([Math]::Cos($a)*$rr) (($random.NextDouble()-.5)*.25) ([Math]::Sin($a)*$rr)) $camera;if($null-ne$ap){$g.FillEllipse($asteroidBrush,[single]$ap.X,[single]$ap.Y,1.2,1.2)}};$asteroidBrush.Dispose()

  if($withUi){
    $fontSmall=[System.Drawing.Font]::new('Segoe UI',[single]8); $fontBody=[System.Drawing.Font]::new('Segoe UI',[single]9)
    $fontTitle=[System.Drawing.Font]::new('Microsoft YaHei UI',[single]24,[System.Drawing.FontStyle]::Bold)
    $fontPanel=[System.Drawing.Font]::new('Microsoft YaHei UI',[single]13,[System.Drawing.FontStyle]::Bold)
    $cyan=New-Object System.Drawing.SolidBrush (To-Color '#64d8ff');$white=New-Object System.Drawing.SolidBrush (To-Color '#f4f7ff');$muted=New-Object System.Drawing.SolidBrush (To-Color '#8490a8')
    $g.DrawString('INTERACTIVE COMPUTER GRAPHICS · AP2',$fontSmall,$cyan,34,27);$g.DrawString('太阳系  层级场景',$fontTitle,$white,31,43);$g.DrawString('曹玥雯 · 软件241 · 2406100102',$fontBody,$muted,35,82)
    $panelRect=New-Object System.Drawing.RectangleF ([single]($width-300)),20,280,390;$panelBrush=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(225,8,13,29));Draw-RoundedRect $g $panelBrush $panelRect 16;$panelBrush.Dispose()
    $g.DrawString('SCENE CONTROL',$fontSmall,$cyan,$width-280,40);$g.DrawString('轨道实验台',$fontPanel,$white,$width-280,58)
    $labels=@('公转速度                          1.0×','自转速度                          1.0×','地球轴倾角                     23.5°');$yy=98
    foreach($label in $labels){$g.DrawString($label,$fontBody,$white,$width-280,$yy);$track=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(125,77,176,220));$g.FillRectangle($track,$width-280,$yy+24,240,3);$track.Dispose();$yy+=62}
    $g.DrawString('轨道线    ●  显示层级运动路径',$fontBody,$white,$width-280,286)
    $btnBrush=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(55,255,255,255));$g.FillRectangle($btnBrush,$width-280,320,114,32);$g.FillRectangle($btnBrush,$width-154,320,114,32);$btnBrush.Dispose()
    $modeLabel=if($projection-eq'perspective'){'透视投影'}else{'正交投影'};$g.DrawString($modeLabel,$fontBody,$white,$width-256,328);$g.DrawString('暂停漫游',$fontBody,$white,$width-131,328)
    $g.DrawString('拖拽  虚拟轨迹球   ·   滚轮  缩放   ·   O  双投影   ·   SPACE  漫游暂停 / 继续',$fontSmall,$muted,35,$height-30)
    $fontSmall.Dispose();$fontBody.Dispose();$fontTitle.Dispose();$fontPanel.Dispose();$cyan.Dispose();$white.Dispose();$muted.Dispose()
  }
  $g.Dispose();return $bmp
}

$script:sunImage=[System.Drawing.Image]::FromFile((Join-Path $projectRoot 'dist\textures\sun.png'))
$script:earthImage=[System.Drawing.Image]::FromFile((Join-Path $projectRoot 'dist\textures\earth.png'))
$script:moonImage=[System.Drawing.Image]::FromFile((Join-Path $projectRoot 'dist\textures\moon.png'))

$perspective=New-SceneFrame 1440 900 1.8 'perspective' $true
$perspective.Save((Join-Path $outPath '01-perspective.png'),[System.Drawing.Imaging.ImageFormat]::Png);$perspective.Dispose()
$orthographic=New-SceneFrame 1440 900 1.8 'orthographic' $true
$orthographic.Save((Join-Path $outPath '02-orthographic.png'),[System.Drawing.Imaging.ImageFormat]::Png);$orthographic.Dispose()

# GDI+ multi-frame GIF: 100 frames × 0.1 s = 10 seconds.
$gifFile=Join-Path $demoPath 'camera-tour-10s.gif'
$encoder=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType-eq'image/gif'}
$first=New-SceneFrame 960 540 0 'perspective' $true
$delays=New-Object byte[] (100*4)
for($i=0;$i-lt100;$i++){[BitConverter]::GetBytes([int]10).CopyTo($delays,$i*4)}
$delayItem=[System.Runtime.Serialization.FormatterServices]::GetUninitializedObject([System.Drawing.Imaging.PropertyItem]);$delayItem.Id=0x5100;$delayItem.Type=4;$delayItem.Len=$delays.Length;$delayItem.Value=$delays
$loopItem=[System.Runtime.Serialization.FormatterServices]::GetUninitializedObject([System.Drawing.Imaging.PropertyItem]);$loopItem.Id=0x5101;$loopItem.Type=3;$loopItem.Len=2;$loopItem.Value=[byte[]](0,0)
try{$first.SetPropertyItem($delayItem);$first.SetPropertyItem($loopItem)}catch{}
$param=New-Object System.Drawing.Imaging.EncoderParameters 1
$param.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::SaveFlag),([long][System.Drawing.Imaging.EncoderValue]::MultiFrame)
$first.Save($gifFile,$encoder,$param)
for($i=1;$i-lt100;$i++){
  $frame=New-SceneFrame 960 540 ($i/10.0) 'perspective' $true
  $param.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::SaveFlag),([long][System.Drawing.Imaging.EncoderValue]::FrameDimensionTime)
  $first.SaveAdd($frame,$param);$frame.Dispose()
}
$param.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::SaveFlag),([long][System.Drawing.Imaging.EncoderValue]::Flush)
$first.SaveAdd($param);$first.Dispose();$param.Dispose()

$script:sunImage.Dispose();$script:earthImage.Dispose();$script:moonImage.Dispose()
Write-Output "Created: $outPath\01-perspective.png"
Write-Output "Created: $outPath\02-orthographic.png"
Write-Output "Created: $gifFile"
