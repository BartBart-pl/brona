# 🚀 BRONA v3.0 - Quick Start (Client-Side)

## Szybkie uruchomienie w 3 krokach

### 1️⃣ Pobierz pliki

Upewnij się że masz pliki:
- `index.html`
- `app.js`
- `styles.css`

### 2️⃣ Uruchom serwer HTTP

**Opcja A - Python (zalecane):**
```bash
python3 serve.py
```

**Opcja B - Python built-in:**
```bash
python3 -m http.server 8000
```

**Opcja C - Bash script:**
```bash
./serve.sh
```

### 3️⃣ Otwórz w przeglądarce

Wejdź na: **http://localhost:8000**

## ✅ To wszystko!

Aplikacja działa w przeglądarce. Wszystkie zapytania do API CEPiK wykonywane są bezpośrednio z Twojej przeglądarki, nie przez serwer.

## 🎯 Pierwsze wyszukiwanie

1. Wybierz województwo (lub zostaw "WSZYSTKIE")
2. Wybierz zakres dat (lub użyj przycisku "Bieżący miesiąc")
3. (Opcjonalnie) Ustaw filtry: marka, model, rok
4. Kliknij "🔍 Wyszukaj pojazdy"
5. Poczekaj na wyniki (może potrwać do minuty dla wszystkich województw)
6. Analizuj dane: filtruj, sortuj, generuj wykresy, eksportuj do CSV/JSON

## 🔧 Troubleshooting

**Problem: Serwer nie startuje**
- Sprawdź czy Python 3 jest zainstalowany: `python3 --version`
- Sprawdź czy port 8000 nie jest zajęty: `lsof -i :8000`

**Problem: Błąd CORS w konsoli przeglądarki**
- API CEPiK powinno obsługiwać CORS
- Jeśli nie działa, możesz użyć proxy CORS

**Problem: Długie ładowanie**
- Użyj filtrów (marka/model) przed wyszukiwaniem
- Wybierz jedno województwo zamiast wszystkich
- Ogranicz zakres dat

## 📚 Więcej informacji

Zobacz **CLIENT_SIDE_README.md** dla pełnej dokumentacji.

---
**Happy searching! 🚗🔍**

