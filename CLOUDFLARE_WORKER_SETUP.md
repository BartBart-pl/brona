# 🚀 Cloudflare Worker - Instrukcja wdrożenia

Ten dokument opisuje jak wdrożyć **CORS proxy** dla aplikacji BRONA na **Cloudflare Workers**.

## 🎯 Po co Cloudflare Worker?

API CEPiK (https://api.cepik.gov.pl) **nie zwraca nagłówków CORS**, co oznacza że przeglądarka blokuje bezpośrednie zapytania JavaScript.

**Rozwiązanie:** Cloudflare Worker działa jako "pośrednik" który:
- ✅ Przyjmuje requesty z aplikacji frontendowej
- ✅ Przekazuje je do API CEPiK
- ✅ Dodaje nagłówki CORS do odpowiedzi
- ✅ Zwraca dane do przeglądarki

**Zalety Cloudflare Workers:**
- 🆓 **Darmowe** (100,000 requestów/dzień)
- ⚡ **Szybkie** (CDN w 200+ lokalizacjach)
- 🔒 **Bezpieczne** (automatyczny HTTPS)
- 🎯 **Proste** (wdrożenie w 5 minut)

---

## 📋 Wymagania

- Konto Cloudflare (darmowe)
- Przeglądarka internetowa
- 5 minut czasu

---

## 🔧 Krok po kroku

### 1️⃣ Utwórz konto Cloudflare (jeśli nie masz)

1. Idź na: https://dash.cloudflare.com/sign-up
2. Zarejestruj się (email + hasło)
3. Potwierdź email
4. Zaloguj się

### 2️⃣ Utwórz nowego Workera

1. W panelu Cloudflare, w lewym menu kliknij **Workers & Pages**
2. Kliknij przycisk **Create** (lub **Create Worker**)
3. Cloudflare wygeneruje losową nazwę (np. `brona-proxy-abc123`)
   - Możesz ją zmienić na własną (np. `brona-proxy`)
   - **WAŻNE:** Zapamiętaj tę nazwę!
4. Kliknij **Deploy** (na razie z domyślnym kodem)

### 3️⃣ Skopiuj kod workera

1. Po utworzeniu workera, kliknij przycisk **Edit code** (lub **Quick edit**)
2. Zobaczysz edytor kodu
3. **Usuń cały domyślny kod**
4. Skopiuj **całą zawartość pliku `worker.js`** z tego projektu
5. Wklej do edytora Cloudflare
6. Kliknij **Save and Deploy**

### 4️⃣ Skopiuj URL workera

Po wdrożeniu zobaczysz URL twojego workera:

```
https://brona-proxy.your-subdomain.workers.dev
```

lub

```
https://your-worker-name.your-subdomain.workers.dev
```

**SKOPIUJ TEN URL!** Będziesz go potrzebować w następnym kroku.

### 5️⃣ Zaktualizuj `app.js`

1. Otwórz plik **`app.js`** w edytorze
2. Znajdź linię z **`API_URL`** (około linii 13-20)
3. **Zakomentuj** linię z lokalnym proxy:

   ```javascript
   // API_URL: '/api',  // Dla developmentu lokalnego
   ```

4. **Odkomentuj i zaktualizuj** linię z Cloudflare Worker:

   ```javascript
   API_URL: 'https://twoj-worker.workers.dev',
   ```

   **Zastąp** `twoj-worker.workers.dev` URL-em z kroku 4!

5. Zapisz plik

**Przykład:**

```javascript
// Przed:
const CONFIG = {
    API_URL: '/api',  // Dla developmentu lokalnego
    // API_URL: 'https://brona-proxy.workers.dev',
    MAX_CONCURRENT_REQUESTS: 5,
    // ...
};

// Po:
const CONFIG = {
    // API_URL: '/api',  // Dla developmentu lokalnego
    API_URL: 'https://brona-proxy-abc123.my-subdomain.workers.dev',
    MAX_CONCURRENT_REQUESTS: 5,
    // ...
};
```

### 6️⃣ Wdróż aplikację

Teraz twoja aplikacja jest w 100% kliencka i możesz ją wdrożyć na dowolnym hostingu statycznym:

**Opcja A: GitHub Pages (darmowe)**
```bash
# 1. Utwórz repozytorium na GitHub
# 2. Push plików (index.html, app.js, styles.css)
# 3. Settings -> Pages -> Source: main branch
# 4. Gotowe! URL: https://username.github.io/repo-name/
```

**Opcja B: Netlify (darmowe)**
```bash
# 1. Idź na https://netlify.com
# 2. Drag & drop folder z plikami
# 3. Gotowe! Automatyczny deployment
```

**Opcja C: Vercel (darmowe)**
```bash
# 1. Idź na https://vercel.com
# 2. Import z GitHub lub drag & drop
# 3. Gotowe!
```

**Opcja D: Cloudflare Pages (darmowe - wszystko w jednym!)**
```bash
# 1. W panelu Cloudflare: Workers & Pages
# 2. Create -> Pages
# 3. Upload folder z plikami
# 4. Gotowe! Wszystko na Cloudflare
```

### 7️⃣ Przetestuj

1. Otwórz aplikację w przeglądarce
2. Wypełnij formularz wyszukiwania
3. Kliknij **Wyszukaj pojazdy**
4. Sprawdź czy dane się ładują

**Jeśli wszystko działa:**
- ✅ Widzisz wyniki w tabeli
- ✅ Konsola deweloperska nie pokazuje błędów CORS
- ✅ Requesty idą przez twojego workera

**Jeśli nie działa:**
- ❌ Sprawdź URL workera w `app.js`
- ❌ Sprawdź konsolę przeglądarki (F12) po szczegóły błędu
- ❌ Sprawdź logi workera w Cloudflare Dashboard

---

## 🔍 Debugowanie

### Sprawdź logi workera

1. W panelu Cloudflare, idź do swojego workera
2. Kliknij **Logs** (lub **Real-time logs**)
3. Odśwież aplikację i wykonaj wyszukiwanie
4. Zobacz co worker loguje

### Sprawdź konsolę przeglądarki

1. Otwórz aplikację w przeglądarce
2. Naciśnij **F12** (DevTools)
3. Idź do **Console**
4. Zobacz błędy JavaScript

### Sprawdź Network tab

1. W DevTools, idź do **Network**
2. Wykonaj wyszukiwanie
3. Zobacz wszystkie requesty
4. Sprawdź czy requesty idą do workera
5. Sprawdź odpowiedzi (status 200 = OK)

---

## 📊 Monitorowanie użycia

Cloudflare Workers ma limit **100,000 requestów/dzień** na darmowym planie.

**Jak sprawdzić użycie:**
1. Panel Cloudflare -> Workers & Pages
2. Kliknij na swojego workera
3. Zobacz **Metrics**

**Ile requestów używa aplikacja:**
- Jedno wyszukiwanie w jednym województwie: **1-10 requestów** (zależnie od liczby stron)
- Jedno wyszukiwanie w WSZYSTKICH województwach: **16-160 requestów** (16 województw × strony)
- Ładowanie słowników: **~5 requestów** (raz przy starcie)

**Przykład:**
- 1000 wyszukiwań dziennie (wszystkie województwa) = ~10,000 requestów
- **Dużo miejsca w limicie!**

---

## 🔒 Bezpieczeństwo

### Czy worker jest bezpieczny?

✅ **TAK!** Worker:
- Tylko przekazuje requesty (nie modyfikuje danych)
- Tylko do `api.cepik.gov.pl` (nie do innych serwerów)
- Dodaje tylko nagłówki CORS
- Nie loguje wrażliwych danych
- Używa HTTPS

### Czy ktoś może nadużyć mojego workera?

Teoretycznie tak, ale:
- Cloudflare automatycznie blokuje DDoS
- Jest limit 100k requestów/dzień
- Możesz dodać rate limiting w kodzie workera
- Możesz ograniczyć dozwolone origins

**Opcjonalnie: Ograniczenie do własnej domeny**

Edytuj `worker.js` i zmień:

```javascript
// Przed:
'Access-Control-Allow-Origin': '*',

// Po (zastąp swoją domeną):
'Access-Control-Allow-Origin': 'https://yourdomain.com',
```

---

## 💰 Koszty

**Darmowy plan:**
- ✅ 100,000 requestów/dzień
- ✅ Wszystkie lokalizacje CDN
- ✅ Automatyczny HTTPS
- ✅ Bez karty kredytowej

**Płatny plan ($5/miesiąc):**
- 10,000,000 requestów/miesiąc
- Dodatkowe funkcje (Durable Objects, KV storage)

**Dla aplikacji BRONA:**
- Darmowy plan **w zupełności wystarczy**
- Nawet przy intensywnym użyciu

---

## 🛠️ Zaawansowane opcje

### Dodaj cache

Cloudflare automatycznie cache'uje odpowiedzi (max-age: 300s = 5 minut).

Jeśli chcesz zmienić:

```javascript
'Cache-Control': 'public, max-age=3600', // 1 godzina
```

### Dodaj rate limiting

```javascript
// Na początku worker.js
const RATE_LIMIT = 100; // requestów na minutę
const rateLimitMap = new Map();

async function checkRateLimit(ip) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const key = `${ip}:${minute}`;

    const count = rateLimitMap.get(key) || 0;
    if (count >= RATE_LIMIT) {
        return false; // Przekroczono limit
    }

    rateLimitMap.set(key, count + 1);
    return true; // OK
}
```

### Dodaj logging

Cloudflare Workers automatycznie loguje wszystkie `console.log()`.

W kodzie workera są już logi:
```javascript
console.log(`Proxy: ${apiPath} -> ${cepikUrl}`)
```

Zobacz je w: **Cloudflare Dashboard -> Worker -> Logs**

---

## 📞 Wsparcie

**Problem z Cloudflare Workers:**
- Dokumentacja: https://developers.cloudflare.com/workers/
- Forum: https://community.cloudflare.com/

**Problem z aplikacją BRONA:**
- GitHub Issues: https://github.com/yourusername/cepik/issues
- Zobacz `TROUBLESHOOTING.md`

---

## ✅ Checklist wdrożenia

- [ ] Utworzyłem konto Cloudflare
- [ ] Utworzyłem nowego Workera
- [ ] Skopiowałem kod z `worker.js`
- [ ] Worker został wdrożony (Deploy)
- [ ] Skopiowałem URL workera
- [ ] Zaktualizowałem `API_URL` w `app.js`
- [ ] Wdrożyłem aplikację na hosting (GitHub Pages/Netlify/Vercel)
- [ ] Przetestowałem działanie
- [ ] Sprawdziłem logi workera
- [ ] Wszystko działa!

---

## 🎉 Gratulacje!

Twoja aplikacja BRONA działa teraz w **100% po stronie klienta**:
- ✅ Frontend: statyczny HTML/JS/CSS
- ✅ Backend: serverless Cloudflare Worker
- ✅ Brak własnego serwera
- ✅ Darmowy hosting
- ✅ Szybkie i skalowalne
- ✅ Bezpieczne (HTTPS)

**Możesz teraz:**
- Wdrożyć na dowolny hosting statyczny
- Skalować bez limitu (Cloudflare CDN)
- Nie martwić się o infrastrukturę
- Cieszyć się darmowym rozwiązaniem!

---

**Stworzone dla projektu BRONA | © 2025**
