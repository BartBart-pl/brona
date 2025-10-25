# 🔧 Rozwiązanie problemu CORS

## Problem

API CEPiK (https://api.cepik.gov.pl) nie zwraca nagłówka `Access-Control-Allow-Origin`, co uniemożliwia bezpośrednie zapytania z przeglądarki (błąd CORS).

```
Access to fetch at 'https://api.cepik.gov.pl/slowniki...' from origin 'http://localhost:8000' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Rozwiązanie: Proxy Server

Używamy prostego proxy serwera w Pythonie, który:
1. Serwuje statyczne pliki HTML/CSS/JS
2. Przekierowuje zapytania `/api/*` do `https://api.cepik.gov.pl/*`
3. Dodaje odpowiednie nagłówki CORS do odpowiedzi
4. Obsługuje starsze certyfikaty SSL API CEPiK

## Użycie

### Uruchomienie serwera proxy

```bash
python proxy_server.py
```

Domyślnie uruchamia się na porcie 8000. Możesz zmienić port:

```bash
python proxy_server.py 3000
```

### Otwórz aplikację

```
http://localhost:8000
```

## Jak to działa?

1. **Przeglądarka** wysyła zapytanie do: `http://localhost:8000/api/slowniki?limit=100&page=1`
2. **Proxy server** przekierowuje do: `https://api.cepik.gov.pl/slowniki?limit=100&page=1`
3. **API CEPiK** zwraca dane (bez nagłówków CORS)
4. **Proxy server** dodaje nagłówki CORS i zwraca dane do przeglądarki
5. **Przeglądarka** akceptuje odpowiedź (CORS OK)

## Schemat

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│  Przeglądarka│────────▶│ Proxy Server │────────▶│  API CEPiK   │
│  (Frontend)  │         │ (Python)     │         │              │
│              │◀────────│              │◀────────│              │
└──────────────┘         └──────────────┘         └──────────────┘
     localhost:8000         localhost:8000          api.cepik.gov.pl
     /index.html            /api/* → przekierowanie
```

## Kod aplikacji

W `app.js` zmieniamy:

```javascript
// PRZED (nie działa - CORS error)
const CONFIG = {
    API_URL: 'https://api.cepik.gov.pl',
    ...
};

// PO (działa - przez proxy)
const CONFIG = {
    API_URL: '/api',  // Proxy endpoint
    ...
};
```

## Alternatywne rozwiązania

### 1. Backend API (Python/Node.js)
- Stwórz dedykowany backend który komunikuje się z API CEPiK
- Frontend komunikuje się z Twoim backendem
- Wymaga hostingu dla backendu

### 2. Rozszerzenie przeglądarki
- Zainstaluj rozszerzenie typu "CORS Unblock"
- **NIE ZALECANE** - działa tylko u Ciebie, nie u użytkowników

### 3. Browser proxy (np. cors-anywhere)
- Użyj publicznego proxy CORS
- **NIE ZALECANE** - problemy z bezpieczeństwem i niezawodnością

## Deployment produkcyjny

Dla produkcji powinieneś:

1. Użyć reverse proxy (nginx, Apache)
2. Skonfigurować przekierowanie `/api/*` do `https://api.cepik.gov.pl/*`
3. Dodać odpowiednie nagłówki CORS

Przykładowa konfiguracja nginx:

```nginx
server {
    listen 80;
    server_name brona.example.com;
    
    # Statyczne pliki
    location / {
        root /var/www/brona;
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy do API CEPiK
    location /api/ {
        proxy_pass https://api.cepik.gov.pl/;
        proxy_ssl_verify off;
        
        # Nagłówki CORS
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
    }
}
```

## FAQ

**Q: Dlaczego nie mogę użyć bezpośrednio API CEPiK?**  
A: Polityka CORS jest zabezpieczeniem przeglądarki. API CEPiK nie zwraca nagłówka `Access-Control-Allow-Origin`, więc przeglądarka blokuje zapytania.

**Q: Czy proxy server spowalnia aplikację?**  
A: Minimalnie. Proxy tylko przekazuje dane bez przetwarzania. Główne opóźnienie to komunikacja z API CEPiK.

**Q: Czy mogę używać proxy server w produkcji?**  
A: Tak, ale lepiej użyć nginx/Apache jako reverse proxy (bardziej wydajne i stabilne).

**Q: Czy proxy server jest bezpieczny?**  
A: Tak. Proxy tylko przekazuje dane między przeglądarką a API CEPiK. Nie przechowuje ani nie modyfikuje danych.

## Troubleshooting

### Port zajęty
```
OSError: [Errno 48] Address already in use
```
**Rozwiązanie:** Zmień port lub zabij proces na porcie 8000:
```bash
lsof -ti:8000 | xargs kill -9
python proxy_server.py 3000
```

### SSL Error
```
ssl.SSLError: [SSL: CERTIFICATE_VERIFY_FAILED]
```
**Rozwiązanie:** Proxy server automatycznie obsługuje to (SECLEVEL=1). Sprawdź czy używasz `proxy_server.py`.

### Timeout
```
URLError: <urlopen error timed out>
```
**Rozwiązanie:** API CEPiK może być wolne. Proxy ma timeout 30s, możesz zwiększyć w kodzie.

---

**BRONA v2.3** - Dokumentacja rozwiązania CORS

