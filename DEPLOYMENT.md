# 🚀 Przewodnik wdrożenia BRONA v4.0

Ten dokument opisuje **kompletny proces wdrożenia** aplikacji BRONA v4.0 w wersji **Full Client-Side**.

## 📋 Czego potrzebujesz?

- ✅ Konto Cloudflare (darmowe)
- ✅ Konto GitHub/Netlify/Vercel (darmowe)
- ✅ 10-15 minut czasu
- ✅ Przeglądarka internetowa

**To wszystko!** Nie potrzebujesz:
- ❌ Własnego serwera
- ❌ Bazy danych
- ❌ Karty kredytowej
- ❌ Doświadczenia z DevOps

---

## 🎯 Architektura końcowa

Po wdrożeniu będziesz miał:

```
┌─────────────┐
│  Użytkownik │
│ (Przeglądka)│
└──────┬──────┘
       │
       │ HTTPS
       │
┌──────▼──────────────────────────────────────┐
│  Frontend (GitHub Pages/Netlify/Vercel)     │
│  - index.html                               │
│  - app.js                                   │
│  - styles.css                               │
└──────┬──────────────────────────────────────┘
       │
       │ JavaScript fetch()
       │
┌──────▼──────────────────────────────────────┐
│  Cloudflare Worker (serverless)             │
│  - worker.js                                │
│  - Dodaje nagłówki CORS                     │
│  - Cache (5 min)                            │
└──────┬──────────────────────────────────────┘
       │
       │ HTTPS
       │
┌──────▼──────────────────────────────────────┐
│  API CEPiK (Rząd Polski)                    │
│  https://api.cepik.gov.pl                   │
└─────────────────────────────────────────────┘
```

**Zalety:**
- 🌍 **Globalna skalowalność** - CDN w 200+ lokalizacjach
- ⚡ **Szybkie** - cache + CDN
- 💰 **Darmowe** - 100% darmowa infrastruktura
- 🔒 **Bezpieczne** - automatyczny HTTPS
- 📈 **Skalowalne** - obsłuży tysiące użytkowników

---

## 📝 Plan wdrożenia (3 kroki)

### Krok 1: Cloudflare Worker (5 minut)
Wdróż CORS proxy na Cloudflare Workers

### Krok 2: Konfiguracja aplikacji (2 minuty)
Zaktualizuj `app.js` z URL workera

### Krok 3: Hosting aplikacji (5 minut)
Upload plików na GitHub Pages/Netlify/Vercel

---

## 🔧 Krok 1: Cloudflare Worker

### 1.1. Utwórz konto Cloudflare

1. Idź na https://dash.cloudflare.com/sign-up
2. Zarejestruj się (email + hasło)
3. Potwierdź email
4. Zaloguj się

### 1.2. Utwórz Worker

1. W panelu Cloudflare kliknij **Workers & Pages** (menu po lewej)
2. Kliknij **Create** (lub **Create Worker**)
3. Cloudflare wygeneruje nazwę (np. `brona-proxy-abc123`)
   - Możesz zmienić na własną (np. `brona-proxy`)
   - **Zapamiętaj tę nazwę!**
4. Kliknij **Deploy**

### 1.3. Wklej kod workera

1. Po utworzeniu kliknij **Edit code**
2. **Usuń cały domyślny kod**
3. Skopiuj **całą zawartość** pliku `worker.js` z tego projektu
4. Wklej do edytora
5. Kliknij **Save and Deploy**

### 1.4. Zapisz URL workera

Worker URL będzie wyglądał tak:
```
https://brona-proxy.your-subdomain.workers.dev
```

lub

```
https://your-custom-name.your-subdomain.workers.dev
```

**SKOPIUJ TEN URL!** Potrzebujesz go w kolejnym kroku.

📖 **Szczegółowa instrukcja:** [CLOUDFLARE_WORKER_SETUP.md](CLOUDFLARE_WORKER_SETUP.md)

---

## ⚙️ Krok 2: Konfiguracja aplikacji

### 2.1. Edytuj app.js

1. Otwórz plik **`app.js`** w edytorze tekstu
2. Znajdź linię z `API_URL` (około linii 13-20)
3. **Zakomentuj** linię z lokalnym proxy:
   ```javascript
   // API_URL: '/api',  // Development lokalny
   ```

4. **Odkomentuj i zaktualizuj** linię z Cloudflare Worker:
   ```javascript
   API_URL: 'https://twoj-worker.workers.dev',  // <-- WKLEJ SWÓJ URL!
   ```

5. **Zapisz plik**

**Przykład przed:**
```javascript
const CONFIG = {
    API_URL: '/api',
    // API_URL: 'https://brona-proxy.workers.dev',
    MAX_CONCURRENT_REQUESTS: 5,
    // ...
};
```

**Przykład po:**
```javascript
const CONFIG = {
    // API_URL: '/api',
    API_URL: 'https://brona-proxy-abc123.my-subdomain.workers.dev',
    MAX_CONCURRENT_REQUESTS: 5,
    // ...
};
```

### 2.2. Sprawdź pliki

Upewnij się że masz te 3 pliki:
- ✅ `index.html`
- ✅ `app.js` (z zaktualizowanym API_URL)
- ✅ `styles.css`

---

## 🌐 Krok 3: Hosting aplikacji

Wybierz jedną z opcji hostingu:

### Opcja A: GitHub Pages (ZALECANA)

**Krok 1: Utwórz repozytorium**
1. Idź na https://github.com/new
2. Nazwa: `brona` (lub inna)
3. Public
4. **NIE** dodawaj README/gitignore
5. Create repository

**Krok 2: Upload plików**
```bash
# W folderze projektu:
git init
git add index.html app.js styles.css
git commit -m "Initial commit - BRONA v4.0"
git branch -M main
git remote add origin https://github.com/username/brona.git
git push -u origin main
```

**Krok 3: Aktywuj GitHub Pages**
1. W repozytorium: Settings
2. Scroll do **Pages** (menu po lewej)
3. Source: **Deploy from a branch**
4. Branch: **main** (root)
5. Save
6. Poczekaj 1-2 minuty

**URL aplikacji:**
```
https://username.github.io/brona/
```

**Gotowe!** 🎉

---

### Opcja B: Netlify (NAJSZYBSZA)

**Krok 1: Drag & Drop**
1. Idź na https://app.netlify.com/drop
2. Przeciągnij folder z plikami (index.html, app.js, styles.css)
3. Poczekaj 10 sekund

**URL aplikacji:**
```
https://random-name-12345.netlify.app
```

**Opcjonalnie: Zmień nazwę**
1. Site settings
2. Change site name
3. Wpisz: `brona-your-name`

**Nowy URL:**
```
https://brona-your-name.netlify.app
```

**Gotowe!** 🎉

---

### Opcja C: Vercel

**Krok 1: Import**
1. Idź na https://vercel.com/new
2. Upload folder z plikami
   lub
   Import z GitHub (jeśli masz repo)

**Krok 2: Deploy**
1. Framework Preset: **Other**
2. Deploy

**URL aplikacji:**
```
https://brona.vercel.app
```

**Gotowe!** 🎉

---

### Opcja D: Cloudflare Pages (WSZYSTKO W JEDNYM MIEJSCU)

**Krok 1: Upload**
1. W panelu Cloudflare: **Workers & Pages**
2. Kliknij **Create**
3. Wybierz **Pages**
4. **Upload assets**
5. Przeciągnij pliki (index.html, app.js, styles.css)

**Krok 2: Deploy**
1. Project name: `brona`
2. Deploy

**URL aplikacji:**
```
https://brona.pages.dev
```

**Zalety:**
- Wszystko w jednym miejscu (Worker + Pages)
- Jeden dashboard do zarządzania
- Automatyczny HTTPS

**Gotowe!** 🎉

---

## ✅ Test wdrożenia

### 1. Otwórz aplikację w przeglądarce

Idź na swój URL (np. `https://username.github.io/brona/`)

### 2. Wypełnij formularz

- Wybierz województwo (np. **WSZYSTKIE**)
- Wybierz zakres dat (użyj przycisku **Bieżący miesiąc**)
- Opcjonalnie: wybierz markę (np. **TOYOTA**)

### 3. Kliknij "Wyszukaj pojazdy"

### 4. Sprawdź wyniki

**Jeśli wszystko działa:**
- ✅ Widzisz spinner "Wyszukiwanie..."
- ✅ Po chwili widzisz wyniki w tabeli
- ✅ Statystyki się aktualizują
- ✅ Możesz generować wykresy
- ✅ Możesz eksportować do CSV

**Jeśli NIE działa:**
- ❌ Sprawdź URL workera w `app.js`
- ❌ Otwórz Console (F12) i zobacz błędy
- ❌ Zobacz [Troubleshooting](#-troubleshooting) poniżej

---

## 🔍 Troubleshooting

### Błąd: "Failed to fetch" lub "Network error"

**Przyczyna:** Zły URL workera w `app.js`

**Rozwiązanie:**
1. Sprawdź czy URL workera jest poprawny
2. Sprawdź czy worker jest wdrożony (status: Active)
3. Sprawdź czy worker działa: otwórz `https://twoj-worker.workers.dev/pojazdy?limit=1&page=1`
   - Powinno zwrócić dane JSON

### Błąd: CORS blocked

**Przyczyna:** Worker nie dodaje nagłówków CORS

**Rozwiązanie:**
1. Sprawdź kod workera (czy masz `Access-Control-Allow-Origin: *`)
2. Redeploy workera (Edit code -> Save and Deploy)

### Aplikacja się nie ładuje

**Przyczyna:** Błąd w JavaScript

**Rozwiązanie:**
1. Otwórz Console (F12)
2. Zobacz błędy JavaScript
3. Sprawdź czy `app.js` ma poprawny URL workera
4. Sprawdź czy wszystkie 3 pliki (index.html, app.js, styles.css) są na hostingu

### Worker przekracza limit

**Przyczyna:** Limit 100k requestów/dzień

**Rozwiązanie:**
1. Sprawdź użycie w panelu Cloudflare (Metrics)
2. Jeśli potrzebujesz więcej, upgrade do płatnego planu ($5/miesiąc, 10M requestów)
3. Lub dodaj rate limiting w kodzie workera

### Dane się nie ładują / API timeout

**Przyczyna:** API CEPiK jest wolne lub niedostępne

**Rozwiązanie:**
1. Sprawdź status API: https://api.cepik.gov.pl/pojazdy?limit=1&page=1
2. Spróbuj ponownie za chwilę
3. Zmniejsz zakres dat (krótszy okres = mniej danych)

---

## 📊 Monitorowanie

### Cloudflare Worker Metrics

1. Panel Cloudflare -> Workers & Pages
2. Kliknij na swojego workera
3. Zobacz **Metrics**:
   - Requests (liczba requestów)
   - Errors (błędy)
   - CPU Time (czas wykonania)

### Logi workera

1. Worker -> **Logs** (lub **Real-time logs**)
2. Odśwież aplikację i wykonaj wyszukiwanie
3. Zobacz logi w czasie rzeczywistym

### Hosting metrics

**GitHub Pages:**
- Settings -> Pages -> Zobacz URL i status

**Netlify:**
- Dashboard -> Zobacz Analytics (bandwidth, requests)

**Vercel:**
- Dashboard -> Analytics

---

## 🔐 Bezpieczeństwo

### Czy moje dane są bezpieczne?

✅ **TAK!**
- Wszystko przez HTTPS
- Żadne dane nie są zapisywane
- Worker tylko przekazuje requesty (nie modyfikuje)
- Aplikacja działa lokalnie w przeglądarce

### Czy ktoś może nadużyć mojego workera?

Teoretycznie tak, ale:
- Cloudflare automatycznie blokuje DDoS
- Jest limit 100k requestów/dzień
- Możesz dodać rate limiting
- Możesz ograniczyć dozwolone origins

**Opcjonalnie: Ograniczenie do swojej domeny**

Edytuj `worker.js`:
```javascript
// Zamień:
'Access-Control-Allow-Origin': '*',

// Na (zastąp swoją domeną):
'Access-Control-Allow-Origin': 'https://username.github.io',
```

---

## 💰 Koszty

### Cloudflare Worker (CORS proxy)
- ✅ **Darmowe:** 100,000 requestów/dzień
- 💵 **Płatne:** $5/miesiąc - 10,000,000 requestów/miesiąc

### Hosting aplikacji
- ✅ **GitHub Pages:** Darmowe (bez limitów)
- ✅ **Netlify:** Darmowe (100 GB bandwidth/miesiąc)
- ✅ **Vercel:** Darmowe (100 GB bandwidth/miesiąc)
- ✅ **Cloudflare Pages:** Darmowe (bez limitów bandwidth)

### Całkowity koszt
**0 zł/miesiąc** (przy normalnym użyciu)

---

## 🎯 Co dalej?

Po wdrożeniu możesz:

### Dostosuj aplikację
- Zmień kolory w `styles.css`
- Dodaj własne logo
- Zmień tytuł strony
- Dodaj Google Analytics

### Udostępnij URL
```
Twoja aplikacja BRONA:
https://username.github.io/brona/
```

### Dodaj Custom Domain
**GitHub Pages:**
1. Kup domenę (np. `brona.pl`)
2. Settings -> Pages -> Custom domain
3. Dodaj CNAME w DNS

**Netlify/Vercel:**
- Automatyczna konfiguracja custom domain

### Monitoruj użycie
- Sprawdzaj metryki w Cloudflare
- Sprawdzaj analytics w hostingu
- Optymalizuj wydajność

---

## 📞 Pomoc

**Problemy z Cloudflare Worker:**
- Dokumentacja: https://developers.cloudflare.com/workers/
- Zobacz: [CLOUDFLARE_WORKER_SETUP.md](CLOUDFLARE_WORKER_SETUP.md)

**Problemy z aplikacją:**
- Zobacz: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- GitHub Issues: [link-do-repo]/issues

**Pytania:**
- Sprawdź [README.md](README.md)
- Sprawdź [CORS_FIX.md](CORS_FIX.md)

---

## 🎉 Gratulacje!

Twoja aplikacja BRONA działa teraz **w 100% po stronie klienta**!

**Masz:**
- ✅ Globalny CDN (Cloudflare)
- ✅ Darmowy hosting
- ✅ Automatyczny HTTPS
- ✅ Nieograniczoną skalowalność
- ✅ Zero własnego backendu

**Możesz:**
- 🌍 Obsłużyć tysiące użytkowników
- 📈 Skalować bez limitu
- 💰 Nie płacić za infrastrukturę
- 🚀 Deployować w minuty

**Ciesz się aplikacją!** 🚗

---

**BRONA - Bieżące Raporty O Nabytych Autach**
**v4.0 - Full Client-Side | © 2025**
