# BRONA v3.0 - Aplikacja Client-Side

## 🎯 Co się zmieniło?

Aplikacja została **całkowicie przepisana** z wersji serwerowej (Streamlit) na **statyczną aplikację HTML/JavaScript**, gdzie:

✅ **Wszystkie zapytania do API CEPiK wykonywane są bezpośrednio z przeglądarki użytkownika**  
✅ **Serwer tylko serwuje statyczne pliki** (HTML, CSS, JavaScript)  
✅ **Brak obciążenia serwera** przy wielu użytkownikach jednocześnie  
✅ **Skalowalna architektura** - możesz hostować na prostym serwerze HTTP, CDN lub GitHub Pages  
✅ **Zero obciążenia backendu** - cała logika działa w przeglądarce  

## 📁 Struktura plików

```
cepik/
├── index.html          # Główny plik HTML (interfejs użytkownika)
├── app.js              # Logika aplikacji (zapytania API, filtry, wykresy)
├── styles.css          # Stylizacja (CSS)
├── serve.py            # Prosty serwer HTTP w Pythonie
├── serve.sh            # Skrypt uruchamiający serwer (Bash)
└── CLIENT_SIDE_README.md  # Ten plik
```

## 🚀 Jak uruchomić?

### Metoda 1: Python HTTP Server (zalecane dla testów lokalnych)

```bash
# Uruchom prosty serwer HTTP
python3 serve.py

# Lub z custom portem
python3 serve.py 8080

# Lub użyj skryptu bash
chmod +x serve.sh
./serve.sh 8000
```

Otwórz przeglądarkę: **http://localhost:8000**

### Metoda 2: Python built-in HTTP server (minimalna opcja)

```bash
# Python 3
python3 -m http.server 8000

# Python 2 (jeśli używasz starszej wersji)
python -m SimpleHTTPServer 8000
```

### Metoda 3: Node.js (http-server)

```bash
# Zainstaluj http-server globalnie
npm install -g http-server

# Uruchom
http-server -p 8000
```

### Metoda 4: Nginx (produkcja)

Skopiuj pliki do katalogu Nginx i skonfiguruj:

```nginx
server {
    listen 80;
    server_name twoja-domena.pl;
    
    root /sciezka/do/cepik;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Kompresja dla lepszej wydajności
    gzip on;
    gzip_types text/html text/css application/javascript application/json;
}
```

### Metoda 5: GitHub Pages / Netlify / Vercel

Wystarczy wrzucić pliki `index.html`, `app.js`, `styles.css` do repozytorium i włączyć hosting statyczny.

## 🔧 Jak to działa?

### Architektura Client-Side

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Przeglądarka│         │   Serwer    │         │  API CEPiK  │
│  użytkownika│         │   HTTP      │         │   (gov.pl)  │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                        │
       │ 1. Pobierz HTML/JS/CSS│                        │
       ├──────────────────────>│                        │
       │                       │                        │
       │ 2. Zwróć pliki        │                        │
       │<──────────────────────┤                        │
       │                       │                        │
       │ 3. Zapytanie do API (bezpośrednio!)            │
       ├────────────────────────────────────────────────>│
       │                       │                        │
       │ 4. Odpowiedź z danymi │                        │
       │<────────────────────────────────────────────────┤
       │                       │                        │
       │ 5. Przetwarzanie w przeglądarce                │
       │    (filtry, sortowanie, wykresy)               │
       │                       │                        │
```

### Dlaczego to lepsze?

1. **Skalowalność**: Serwer serwuje tylko statyczne pliki - możesz obsłużyć tysiące użytkowników jednocześnie bez dodatkowego obciążenia
2. **Koszt**: Brak kosztów obliczeniowych po stronie serwera - możesz hostować na najtańszym hostingu
3. **Szybkość**: Po załadowaniu strony wszystko działa lokalnie w przeglądarce
4. **Offline**: Po załadowaniu strony możesz pracować z pobranymi danymi nawet bez internetu
5. **CDN**: Możesz umieścić na CDN dla szybszego ładowania na całym świecie

## ⚠️ Ważne uwagi

### CORS (Cross-Origin Resource Sharing)

API CEPiK **powinno** obsługiwać zapytania CORS z przeglądarki. Jeśli napotkasz błędy CORS, możliwe rozwiązania:

1. **Sprawdź w konsoli przeglądarki** czy API zwraca odpowiednie nagłówki CORS
2. **Użyj proxy CORS** (tylko do testów):
   ```javascript
   // W app.js zmień CONFIG.API_URL na:
   API_URL: 'https://cors-anywhere.herokuapp.com/https://api.cepik.gov.pl'
   ```
3. **Ustaw prosty proxy na swoim serwerze** (dla produkcji)

### SSL/TLS

- Stara wersja (Streamlit) używała custom SSL adapter dla starszych certyfikatów
- W przeglądarce nie masz kontroli nad SSL - **to przeglądarki decydują czy akceptują certyfikat**
- Nowoczesne przeglądarki (Chrome, Firefox, Safari) powinny obsłużyć certyfikat API CEPiK bez problemu

### Rate Limiting

- API CEPiK może mieć limity zapytań
- Aplikacja automatycznie:
  - Wykonuje zapytania sekwencyjnie dla bezpieczeństwa
  - Obsługuje paginację (pobiera wszystkie strony)
  - Deduplikuje wyniki między województwami

## 🆚 Porównanie: Streamlit vs Client-Side

| Funkcja | Streamlit (stara wersja) | Client-Side (nowa wersja) |
|---------|--------------------------|---------------------------|
| Gdzie wykonywane są zapytania | Serwer (backend) | Przeglądarka (klient) |
| Obciążenie serwera | **Wysokie** - każde zapytanie obciąża serwer | **Minimalne** - tylko statyczne pliki |
| Skalowalność | Ograniczona mocą serwera | Nieograniczona (CDN) |
| Koszt hostingu | Wymaga serwera z Python + RAM | Prosty hosting statyczny |
| Offline mode | Nie | Tak (po załadowaniu) |
| Instalacja zależności | Tak (requirements.txt) | Nie (wszystko w przeglądarce) |
| Deploy | Streamlit Cloud / VPS | Dowolny hosting / GitHub Pages |

## 📊 Funkcje aplikacji

Wszystkie funkcje z wersji Streamlit zostały zachowane:

✅ Wyszukiwanie pojazdów według województwa i zakresu dat  
✅ Filtry: marka, model, rok produkcji, rodzaj pojazdu, paliwo  
✅ Przeszukiwanie wszystkich województw równolegle  
✅ Automatyczna paginacja (pobiera wszystkie strony)  
✅ Deduplikacja wyników  
✅ Filtry dynamiczne po pobraniu danych  
✅ Sortowanie tabeli  
✅ Wizualizacje (wykresy słupkowe, kołowe, histogramy)  
✅ Eksport do CSV i JSON  
✅ Responsywny design (mobile-friendly)  
✅ Statystyki w czasie rzeczywistym  

## 🔒 Bezpieczeństwo

- **Brak backendu = brak powierzchni ataku po stronie serwera**
- Wszystkie dane użytkownika pozostają w jego przeglądarce
- Brak logów zapytań na serwerze
- Brak przechowywania danych użytkownika

## 🌐 Deployment na produkcję

### GitHub Pages (darmowy hosting)

1. Utwórz repo na GitHub
2. Dodaj pliki: `index.html`, `app.js`, `styles.css`
3. Włącz GitHub Pages w ustawieniach repo
4. Gotowe! Dostępne pod: `https://twoj-username.github.io/repo-name/`

### Netlify (darmowy hosting)

```bash
# Zainstaluj Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### Vercel (darmowy hosting)

```bash
# Zainstaluj Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## 📝 Customizacja

### Zmiana stylu

Edytuj `styles.css` - zmienne CSS na początku pliku:

```css
:root {
    --primary-color: #0d6efd;
    --secondary-color: #6c757d;
    --success-color: #198754;
    /* ... */
}
```

### Dodanie nowych filtrów

Edytuj `app.js` - funkcja `applyFilters()` i dodaj kontrolki w `index.html`.

### Zmiana API URL

W `app.js`:

```javascript
const CONFIG = {
    API_URL: 'https://twoje-proxy-api.com', // Zmień tutaj
    // ...
};
```

## 🐛 Troubleshooting

### Problem: Błąd CORS

**Objawy**: W konsoli przeglądarki widzisz błąd "CORS policy"

**Rozwiązanie**:
- Sprawdź czy API CEPiK wspiera CORS
- Użyj proxy CORS (tylko testy)
- Skonfiguruj własny proxy na serwerze

### Problem: Długie ładowanie

**Objawy**: Pobieranie danych trwa bardzo długo

**Rozwiązanie**:
- Użyj filtrów marki/modelu przed wyszukiwaniem (zmniejsza ilość danych)
- Ogranicz zakres dat
- Wybierz jedno województwo zamiast wszystkich

### Problem: Przeglądarka blokuje Mixed Content

**Objawy**: Błąd "Mixed Content" gdy strona jest HTTPS a API HTTP

**Rozwiązanie**:
- API CEPiK używa HTTPS, więc nie powinno być problemu
- Upewnij się że hosting też używa HTTPS

## 📞 Kontakt / Support

Jeśli masz pytania lub problemy, sprawdź:
- Konsolę przeglądarki (F12) dla błędów JavaScript
- Zakładkę Network (Sieć) dla błędów API
- Dokumentację API CEPiK: https://api.cepik.gov.pl/

## 📄 Licencja

© 2025 BRONA - Bieżące Raporty O Nabytych Autach  
Dane pochodzą z CEPiK (Centralna Ewidencja Pojazdów i Kierowców)

---

**Gratulacje!** Masz teraz w pełni funkcjonalną aplikację client-side, która nie obciąża serwera! 🎉

