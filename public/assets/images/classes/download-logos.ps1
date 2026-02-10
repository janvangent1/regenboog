# Download class logos from scholen.stad.gent (run once)
$base = "https://scholen.stad.gent/sites/default/files/styles/article/public/classes"
$pairs = @(
    @("konijnen", "Konijn%20website.jpg?itok=mpiFJge2"),
    @("pinguins", "Pinguin%20website.jpg?itok=ik9-Dtgb"),
    @("eenden", "Eend%20website.jpg?itok=CiSkLW1B"),
    @("muizen", "Muis%20website.jpg?itok=rmDo2CIm"),
    @("dolfijnen", "Dolfijn%20website.jpg?itok=i724DBtc"),
    @("nijlpaarden", "Nijlpaard%20website.jpg?itok=PKm4b96J"),
    @("lieveheersbeestjes", "Lieveheersbeestje%20website.jpg?itok=CwzSYH8h"),
    @("uilen", "Uil%20website.jpg?itok=J3IM69Ee"),
    @("kangoeroes", "Kangoeroe%20website.jpg?itok=sw5N1zLC"),
    @("vossen", "Vos%20website.jpg?itok=zZ-w-EHZ"),
    @("draken", "Draak%20website_0.jpg?itok=oP109Rzh"),
    @("beren", "Beer%20website.jpg?itok=n1wiiLae"),
    @("leeuwen", "Leeuw%20website.jpg?itok=B2oFpC9x"),
    @("vlinders", "Vlinder%20website.jpg?itok=r8QCNdPu"),
    @("egels", "Egel%20website.jpg?itok=MIBSfzs2"),
    @("wolven", "Wolf%20website.jpg?itok=ybZI8Ga6"),
    @("koalas", "Koala%20website.jpg?itok=f1fZgFI2"),
    @("olifanten", "Olifant%20website.jpg?itok=j3sQ2cBo"),
    @("giraffen", "Giraf%20website.jpg?itok=0P9r7ZEB"),
    @("zebras", "Zebra%20website.jpg?itok=dosFRrio"),
    @("pandas", "Panda%20website.jpg?itok=2u_X7_S3"),
    @("zwaluwen", "Zwaluw%20website_0.jpg?itok=C1zhNm3K")
)
$outDir = $PSScriptRoot
foreach ($p in $pairs) {
    $id = $p[0]
    $path = $p[1]
    $url = "$base/$path"
    $outPath = Join-Path $outDir "$id.jpg"
    try {
        Invoke-WebRequest -Uri $url -OutFile $outPath -UseBasicParsing
        Write-Host "OK $id"
    } catch {
        Write-Host "FAIL $id : $_"
    }
}
