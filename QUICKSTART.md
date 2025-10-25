# 🚀 Quick Start - Aplikacja CEPiK

## Szybki start (5 minut)

### 1. Instalacja (jednorazowo)

```bash
# Uruchom skrypt instalacyjny
./setup.sh
```

### 2. Uruchomienie aplikacji

```bash
# Metoda 1: Za pomocą skryptu
./run.sh

# Metoda 2: Ręcznie
source env/bin/activate
streamlit run app.py
```

### 3. Otwórz w przeglądarce

Aplikacja automatycznie otworzy się w przeglądarce pod adresem:
```
http://localhost:8501
```

## Pierwsze kroki

### Przykład 1: Wyszukaj wszystkie Toyoty
1. W panelu po lewej wybierz markę: **Toyota**
2. Ustaw lata produkcji: **2010-2024**
3. Kliknij **"🔎 Szukaj"**
4. Przeglądaj wyniki w tabeli i na wykresach

### Przykład 2: Pojazdy w Twoim województwie
1. Zostaw markę pustą (wszystkie marki)
2. Wybierz województwo: np. **mazowieckie**
3. Ustaw lata: **2015-2023**
4. Kliknij **"🔎 Szukaj"**
5. Zobacz rozkład marek w wykresie kołowym

### Przykład 3: Eksport danych do Excel
1. Wykonaj dowolne wyszukiwanie
2. Przewiń na dół do sekcji **"💾 Eksport danych"**
3. Kliknij **"📥 Pobierz wyniki jako CSV"**
4. Otwórz plik w Excel lub Google Sheets

## Test połączenia z API

Przed pierwszym użyciem możesz przetestować połączenie z API:

```bash
source env/bin/activate
python test_api.py
```

## Rozwiązywanie problemów

### Problem: "Nie można połączyć z API"
**Rozwiązanie:** Sprawdź połączenie internetowe i dostępność API:
```bash
curl https://api.cepik.gov.pl/doc
```

### Problem: "streamlit: command not found"
**Rozwiązanie:** Aktywuj wirtualne środowisko:
```bash
source env/bin/activate
```

### Problem: "Brak wyników wyszukiwania"
**Rozwiązanie:** 
- Rozszerz zakres lat
- Usuń niektóre filtry
- Sprawdź czy API działa (test_api.py)

## Wymagania systemowe

- **System operacyjny**: macOS, Linux, Windows
- **Python**: 3.7 lub nowszy
- **RAM**: minimum 512 MB
- **Połączenie**: dostęp do internetu
- **Przeglądarka**: Chrome, Firefox, Safari, Edge

## Funkcje aplikacji

### 🔍 Wyszukiwanie
- Filtrowanie po marce i modelu
- Zakres lat produkcji
- Zakres lat pierwszej rejestracji
- Wybór województwa

### 📊 Wizualizacje
- Rozkład według roku produkcji
- Rozkład według województw
- Top 10 najpopularniejszych marek
- Interaktywne wykresy Plotly

### 💾 Eksport danych
- Format CSV
- Pełne dane z wyników wyszukiwania
- Gotowy do importu w Excel

### 📈 Statystyki
- Liczba pojazdów
- Liczba marek
- Średni rok produkcji
- Liczba województw

## Struktura projektu

```
cepik/
├── 📄 app.py              # Główna aplikacja
├── 📄 cepik_api.py        # Komunikacja z API
├── 📄 config.py           # Konfiguracja
├── 📄 test_api.py         # Testy
├── 📄 requirements.txt    # Zależności
├── 🔧 setup.sh            # Instalacja
├── 🚀 run.sh              # Uruchomienie
├── 📚 README.md           # Dokumentacja
├── 📚 DOCS.md             # Pełna dokumentacja
└── 📚 QUICKSTART.md       # Ten plik
```

## Następne kroki

1. ✅ Zainstaluj aplikację (`./setup.sh`)
2. ✅ Uruchom aplikację (`./run.sh`)
3. ✅ Wypróbuj przykładowe wyszukiwania
4. 📖 Przeczytaj pełną dokumentację (`DOCS.md`)
5. 🧪 Przetestuj API (`python test_api.py`)
6. 🎨 Dostosuj konfigurację (`.env`)

## Dodatkowe zasoby

- **API CEPiK**: https://api.cepik.gov.pl/doc
- **Streamlit Docs**: https://docs.streamlit.io
- **Plotly Charts**: https://plotly.com/python/
- **Pandas Guide**: https://pandas.pydata.org/docs/

## Wsparcie

Masz problem? Sprawdź:
1. `DOCS.md` - pełna dokumentacja
2. `test_api.py` - test połączenia
3. Logi w terminalu
4. Dokumentacja API CEPiK

---

**Gotowy do startu?** Uruchom: `./setup.sh && ./run.sh` 🚀


