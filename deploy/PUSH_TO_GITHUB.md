# Push naar GitHub – Instructies

De code is lokaal gecommit. Om naar GitHub te pushen moet je **eenmalig authenticeren**.

## Optie 1: Push in je eigen terminal (aanbevolen)

1. Open **PowerShell** of **Command Prompt** in de projectmap:
   ```
   cd "d:\OneDrive\Documenten\software projects\regenboog game"
   ```

2. Push naar GitHub:
   ```
   git push -u origin master
   ```

3. Als Git om gebruikersnaam/wachtwoord vraagt:
   - **Username:** `janvangent1`
   - **Password:** gebruik een **Personal Access Token** (niet je gewone wachtwoord).
   
   Token aanmaken: GitHub → Settings → Developer settings → Personal access tokens → Generate new token.  
   Geef minimaal de scope **repo** mee.

4. Als je repository op GitHub de standaard branch **main** gebruikt en je wilt dezelfde naam lokaal hebben:
   ```
   git branch -M main
   git push -u origin main
   ```

## Optie 2: URL met token (geen prompt)

Als je een Personal Access Token hebt, kun je één keer pushen met:

```
git remote set-url origin https://janvangent1/JOUW_TOKEN@github.com/janvangent1/regenboog.git
git push -u origin master
```

Daarna de remote weer veilig zetten (zonder token in de URL):

```
git remote set-url origin https://github.com/janvangent1/regenboog.git
```

## Controle

- **Commit:** `Initial commit: Regenboog game suite with deploy scripts` (124 bestanden)
- **Remote:** `https://github.com/janvangent1/regenboog.git`
- **Branch:** `master` (eventueel hernoemen naar `main` als je repo dat gebruikt)

## Wat er al gedaan is

- Git repository geïnitialiseerd
- Remote `origin` toegevoegd
- Alle bestanden toegevoegd (behalve o.a. `node_modules/`, `data/`, `deploy_config.json`, `setup_config.json`)
- Eerste commit gemaakt

Je hoeft alleen nog `git push` uit te voeren in een terminal waar je kunt inloggen.
