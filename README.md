# WatchList

Mobilní watchlist aplikace (React Native / Expo) pro filmy a seriály s daty z [TMDB](https://www.themoviedb.org/).

## Funkce

- Vyhledávání filmů a seriálů (TMDB)
- Seznamy **Ke zhlédnutí** a **Zhlédnuté** + přesouvání mezi nimi
- Vlastní hodnocení (1–10) a komentáře
- Detailní stránky, tracking sérií/dílů, novinky
- **Automatická záloha na Google Drive přímo z mobilu** (nativní Google Sign-In)
- Manuální JSON export/import jako pojistka
- Lokální **SQLite** DB (položky + žánry + lidi — API se nevolá znovu, pokud už metadata jsou)

## Spuštění (základ)

```bash
npm install
cp .env.example .env
# doplň TMDB klíč
npx expo start
```

Pro běžné používání watchlistu stačí **Expo Go**.  
Pro **Google Drive zálohu v telefonu** potřebuješ development build (níže).

## TMDB

1. [TMDB API settings](https://www.themoviedb.org/settings/api)
2. `.env` → `EXPO_PUBLIC_TMDB_API_KEY=` (bez `Bearer`)
3. Restartuj Expo

## Google Drive na mobilu (Android)

Google Web OAuth (`watchlist://` redirect) v telefonu nefunguje. Appka proto používá **nativní Google Sign-In** — to vyžaduje vlastní instalaci appky (ne Expo Go).

### 1) Google Cloud

1. [Google Cloud Console](https://console.cloud.google.com/) → projekt
2. Zapni **Google Drive API**
3. **OAuth consent screen** (External, Testing) + test user (tvůj Gmail)
4. Scopes (vyhledej a zaškrtni celé URL):
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `openid`
5. **Credentials → Create OAuth client ID** — vytvoř **oba**:

#### A) Web application
- Typ: **Web application**
- Redirect URIs zatím nemusíš řešit (pro nativní Sign-In)
- Zkopíruj Client ID do `.env`:

```env
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
```

#### B) Android
- Typ: **Android**
- Package name: `com.watchlist.app`
- SHA-1: fingerprint keystoreu, kterým je APK podepsané (viz níže)
- Client ID Android se do `.env` / EAS env nedává — Google ho páruje přes package + SHA-1
- Do jednoho Android klienta můžeš přidat **více SHA-1** (debug i EAS)

### 2) Zjisti SHA-1 (kritické pro Google Sign-In)

**EAS APK** (`eas build --profile apk`) používá **EAS keystore** — jiný SHA-1 než lokální debug:

```bash
eas credentials -p android
```

Vyber profil `apk` / `preview` → Keystore → zkopíruj **SHA-1 fingerprint** do Google Cloud Android OAuth klienta.

**Lokální** `npx expo run:android` používá `android/app/debug.keystore`:

```powershell
keytool -list -v -keystore ".\android\app\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

> Když v Google Console chybí SHA-1 z EAS buildu, Drive v APK spadne na `DEVELOPER_ERROR` i když lokálně fungoval.


### 3) Nainstaluj appku do telefonu

Telefon: zapni USB debugging, nebo použij emulátor. Pak:

```bash
npx expo run:android
```

Tím se sestaví development build s Google Sign-In a nainstaluje se jako **WatchList** (ne Expo Go).

### 4) Připoj Drive

V nainstalované appce: **Nastavení → Připojit Google Drive** → zapni automatickou zálohu.

Soubor na Disku: `WatchList-backup.json`.

> Ve fázi Testing funguje jen pro Gmail přidaný jako test user.

### DEVELOPER_ERROR (code 10)

Skoro vždy špatný SHA-1 nebo package. Checklist:

1. Android OAuth client: package přesně `com.watchlist.app`
2. SHA-1 odpovídá **tomu buildu**, který právě běží (EAS → `eas credentials`, lokálně → `android/app/debug.keystore`)
3. V env je **Web** Client ID (ne Android Client ID)
4. Po úpravě v Console počkej 2–5 minut a appku znovu otevři / přeinstaluj


## Manuální záloha

V Nastavení pořád zůstává **Exportovat / Obnovit JSON** (Google Drive, e-mail, Soubory…) — funguje i v Expo Go.

## Struktura

- `app/` — obrazovky
- `src/services/googleSignIn.ts` — nativní přihlášení
- `src/services/googleDrive.ts` — upload/download zálohy
- `src/db/` — SQLite schéma a repository
- `src/store/` — in-memory stav (Zustand) napojený na SQLite + Drive

## Poznámka k TMDB

This product uses the TMDB API but is not endorsed or certified by TMDB.
