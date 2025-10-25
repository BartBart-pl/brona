# 🚗 BRONA - Bieżące Raporty O Nabytych Autach

Aplikacja webowa do wyszukiwania i analizy danych o pojazdach zarejestrowanych w Polsce z wykorzystaniem API CEPiK (Centralna Ewidencja Pojazdów i Kierowców).

## 🆕 NOWOŚĆ: Wersja Client-Side (v3.0)

**⚡ Aplikacja została całkowicie przepisana!**

Teraz dostępne są **dwie wersje**:
1. **v3.0 Client-Side** (ZALECANA) - Statyczna strona HTML/JavaScript
   - ✅ Wszystkie zapytania wykonywane **bezpośrednio z przeglądarki użytkownika**
   - ✅ **Zero obciążenia serwera** - serwer tylko serwuje statyczne pliki
   - ✅ **Nieograniczona skalowalność** - możesz obsłużyć tysiące użytkowników jednocześnie
   - ✅ **Darmowy hosting** - GitHub Pages, Netlify, Vercel, prosty HTTP server
   - 📖 Dokumentacja: [CLIENT_SIDE_README.md](CLIENT_SIDE_README.md)
   - 🚀 Quick start: [QUICKSTART_CLIENT.md](QUICKSTART_CLIENT.md)

2. **v2.3 Server-Side** (STARSZA) - Aplikacja Streamlit
   - ⚠️ Wszystkie zapytania przez serwer (wysokie obciążenie)
   - ⚠️ Wymaga Pythona i zależności
   - ⚠️ Ograniczona skalowalność
   - 📖 Dokumentacja poniżej

---

## 🎯 Jak wybrać wersję?

| Sytuacja | Zalecana wersja |
|----------|-----------------|
| Chcę hostować dla wielu użytkowników | **v3.0 Client-Side** |
| Chcę najtańszy hosting | **v3.0 Client-Side** |
| Chcę prosty deployment | **v3.0 Client-Side** |
| Chcę użyć do testów lokalnych | Obie wersje działają |
| Potrzebuję backendu z logowaniem | v2.3 Server-Side |

---

# 🚀 Quick Start - v3.0 Client-Side (ZALECANA)

```bash
# 1. Uruchom proxy server (rozwiązuje problem CORS)
python proxy_server.py

# 2. Otwórz przeglądarkę
open http://localhost:8000
```

**To wszystko!** Aplikacja działa w przeglądarce.

### ⚠️ Problem CORS
API CEPiK nie zwraca nagłówków CORS, więc bezpośrednie zapytania z przeglądarki są blokowane.  
**Rozwiązanie:** Używamy prostego proxy serwera (`proxy_server.py`).  
📖 Szczegóły: [CORS_FIX.md](CORS_FIX.md)

---

# 📚 Dokumentacja v2.3 Server-Side (STARSZA WERSJA)

## 🌟 Funkcje

### 🔍 Wyszukiwanie
- **Wszystkie województwa jednocześnie** - pobieranie danych równolegle z obsługą rate limiting
- **Filtry pre-query** - marka, model, rodzaj pojazdu, rodzaj paliwa, pochodzenie, sposób produkcji
- **Filtry post-query** - rok produkcji, masa własna, pojemność skokowa i inne parametry
- **Brak limitu wyników** - automatyczne pobieranie wszystkich stron z API
- **Deduplication** - automatyczne usuwanie duplikatów po ID pojazdu

### 📊 Analiza i wizualizacja
- **Dynamiczne wykresy** - słupkowe, histogram, scatter, box plot
- **Batch tracking** - każde zapytanie ma przypisany unikalny kolor na wykresach
- **Łączenie wyników** - możliwość dodawania wyników z wielu zapytań
- **Interaktywne tabele** - sortowanie po kliknięciu nagłówka kolumny
- **Filtry dynamiczne** - automatyczne wykrywanie typów kolumn (numeryczne, kategoryczne)

### 💾 Export
- Eksport wyników do CSV
- Zachowanie danych w sesji aplikacji

## 🚀 Uruchomienie

### Wymagania
```bash
Python 3.8+
```

### Instalacja

1. Sklonuj repozytorium:
```bash
git clone git@github.com:BartBart-pl/brona.git
cd brona
```

2. Utwórz i aktywuj środowisko wirtualne:
```bash
python -m venv env
source env/bin/activate  # Linux/Mac
# lub
env\Scripts\activate  # Windows
```

3. Zainstaluj zależności:
```bash
pip install -r requirements.txt
```

4. Uruchom aplikację:
```bash
streamlit run app.py
```

Aplikacja uruchomi się domyślnie pod adresem: `http://localhost:8501`

## 📁 Struktura projektu

```
brona/
├── app.py                 # Główna aplikacja Streamlit
├── cepik_api.py          # Moduł do komunikacji z API CEPiK
├── requirements.txt      # Zależności Python
├── README.md            # Ten plik
└── test_api.py          # Testy funkcjonalności API
```

## 🔧 Konfiguracja

### API CEPiK
Aplikacja korzysta z publicznego API CEPiK dostępnego pod adresem: https://api.cepik.gov.pl/

**Uwaga:** API CEPiK używa starszych certyfikatów SSL. Aplikacja automatycznie obsługuje to poprzez custom SSL adapter.

### Funkcje zaawansowane

#### Równoległe pobieranie
Przy wyborze opcji "WSZYSTKIE" województwa, aplikacja:
- Wykonuje zapytania równolegle dla wszystkich 16 województw
- Implementuje retry mechanism (1 powtórzenie)
- Obsługuje rate limiting z automatycznym wstrzymaniem na 30s
- Pokazuje live progress dla każdego województwa

#### Normalizacja danych
- Automatyczne usuwanie nazwy marki z modelu (np. "TOYOTA CAMRY" → "CAMRY")
- Konwersja kodów województw na nazwy słowne
- Konwersja kolumn numerycznych na odpowiednie typy (int/float)

## 📊 Słowniki API

Aplikacja dynamicznie pobiera słowniki wartości z API CEPiK:
- **marka** - marki pojazdów (7900+ wartości)
- **rodzaj-pojazdu** - typy pojazdów (379 wartości)
- **rodzaj-paliwa** - rodzaje paliwa (12 wartości)
- **pochodzenie-pojazdu** - pochodzenie (10 wartości)
- **sposob-produkcji** - sposób produkcji (tylko wartości słowne)

## 🛠️ Technologie

- **Streamlit** - framework aplikacji webowej
- **Pandas** - przetwarzanie danych
- **Plotly** - wizualizacje interaktywne
- **Requests** - komunikacja z API
- **Threading** - równoległe pobieranie danych

## 📝 Licencja

Projekt stworzony na potrzeby edukacyjne i analityczne.
Dane pochodzą z publicznego API CEPiK (Ministerstwo Cyfryzacji).

## 👨‍💻 Autor

© 2025 | Wersja 3.0 (Client-Side) + v2.3 (Server-Side)

## 🐛 Zgłaszanie błędów

W przypadku znalezienia błędów, proszę o utworzenie issue w repozytorium GitHub.

## 🔄 Historia wersji

### v3.0 (2025-10-25) - CLIENT-SIDE REVOLUTION 🎉
- **CAŁKOWITE PRZEPISANIE** aplikacji na statyczną stronę HTML/JavaScript
- Wszystkie zapytania do API wykonywane bezpośrednio z przeglądarki użytkownika
- Zero obciążenia serwera - serwer tylko serwuje statyczne pliki
- Nieograniczona skalowalność - możesz hostować na CDN, GitHub Pages, Netlify, Vercel
- Prosty deployment - wystarczy Python HTTP server lub dowolny hosting statyczny
- Wszystkie funkcje z v2.3 zachowane
- Nowe: Responsywny design, Bootstrap 5, ulepszone UI
- Pliki: `index.html`, `app.js`, `styles.css`, `serve.py`
- Dokumentacja: `CLIENT_SIDE_README.md`, `QUICKSTART_CLIENT.md`

### v2.3 (2025-01-25) - Server-Side
- Zmiana nazwy aplikacji na BRONA
- Filtry numeryczne na integerach
- Poprawione filtrowanie pojemności skokowej
- Filtrowanie sposobu produkcji - tylko wartości słowne
- Ulepszona lista wyboru marek

### v2.2 (2025-01)
- Dynamiczne słowniki z API
- Batch tracking dla wykresów
- Połączenie wszystkich filtrów w jedną sekcję

### v2.1 (2025-01)
- Równoległe pobieranie wszystkich województw
- Rate limiting i retry mechanism
- Pagination i deduplication

### v2.0 (2025-01)
- Przepisanie na prawdziwe API CEPiK
- Pre-query filtering
- SSL adapter dla starszych certyfikatów

---

**BRONA** - *Bieżące Raporty O Nabytych Autach* 🚗
