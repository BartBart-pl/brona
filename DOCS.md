# Dokumentacja Aplikacji CEPiK

## Spis treści
1. [Wprowadzenie](#wprowadzenie)
2. [Architektura](#architektura)
3. [Instalacja](#instalacja)
4. [Użytkowanie](#użytkowanie)
5. [API](#api)
6. [Rozwój](#rozwój)

## Wprowadzenie

Aplikacja CEPiK to interfejs webowy do przeglądania danych z Centralnej Ewidencji Pojazdów i Kierowców. Umożliwia wyszukiwanie i analizę danych o pojazdach zarejestrowanych w Polsce.

### Technologie

- **Frontend/Backend**: Streamlit (Python)
- **API**: REST API CEPiK (https://api.cepik.gov.pl)
- **Wizualizacje**: Plotly
- **Przetwarzanie danych**: Pandas

## Architektura

```
cepik/
├── app.py              # Główna aplikacja Streamlit
├── cepik_api.py        # Moduł komunikacji z API
├── config.py           # Konfiguracja aplikacji
├── test_api.py         # Testy API
├── requirements.txt    # Zależności Python
├── setup.sh           # Skrypt instalacyjny
├── run.sh             # Skrypt uruchomieniowy
└── README.md          # Dokumentacja podstawowa
```

### Komponenty

#### 1. `app.py` - Aplikacja główna
- Interfejs użytkownika Streamlit
- Filtry wyszukiwania
- Wyświetlanie wyników
- Wizualizacje danych
- Eksport do CSV

#### 2. `cepik_api.py` - Moduł API
Klasa `CepikAPI` zawiera metody:
- `get_brands()` - pobieranie marek pojazdów
- `get_models(brand)` - pobieranie modeli dla marki
- `get_voivodeships()` - pobieranie województw
- `search_vehicles(...)` - wyszukiwanie pojazdów
- `get_vehicle_statistics(...)` - statystyki pojazdów
- `vehicles_to_dataframe(data)` - konwersja do DataFrame

#### 3. `config.py` - Konfiguracja
- URL API
- Ustawienia Streamlit
- Domyślne wartości
- Stałe aplikacji

## Instalacja

### Wymagania
- Python 3.7 lub nowszy
- pip
- Połączenie internetowe (dla API)

### Automatyczna instalacja (macOS/Linux)

```bash
# Nadaj uprawnienia
chmod +x setup.sh

# Uruchom instalację
./setup.sh
```

### Ręczna instalacja

```bash
# 1. Utwórz wirtualne środowisko
python3 -m venv env

# 2. Aktywuj środowisko
source env/bin/activate  # macOS/Linux

# 3. Zainstaluj zależności
pip install -r requirements.txt
```

## Użytkowanie

### Uruchomienie aplikacji

#### Metoda 1: Skrypt (macOS/Linux)
```bash
chmod +x run.sh
./run.sh
```

#### Metoda 2: Bezpośrednio
```bash
source env/bin/activate
streamlit run app.py
```

### Interfejs użytkownika

#### Panel boczny (Filtry)
- **Marka pojazdu**: Lista marek z API
- **Model pojazdu**: Dynamicznie ładowany dla wybranej marki
- **Rok produkcji**: Zakres lat (od-do)
- **Pierwsza rejestracja**: Zakres lat pierwszej rejestracji
- **Województwo**: Lista województw

#### Główny panel
- **Wyniki wyszukiwania**: Liczba pojazdów, marki, statystyki
- **Tabela danych**: Interaktywna tabela z wynikami
- **Wizualizacje**: Wykresy rozkładów
- **Eksport**: Pobieranie danych do CSV

### Przykładowe użycie

1. **Wyszukiwanie wszystkich Toyot z lat 2015-2020**
   - Marka: Toyota
   - Rok produkcji: 2015-2020
   - Kliknij "Szukaj"

2. **Pojazdy w województwie mazowieckim**
   - Województwo: mazowieckie
   - Rok produkcji: 2010-2024
   - Kliknij "Szukaj"

3. **Analiza konkretnego modelu**
   - Marka: BMW
   - Model: X5
   - Rok produkcji: 2018-2023
   - Kliknij "Szukaj"

## API

### Endpointy CEPiK

#### GET /slowniki/marki
Pobiera listę marek pojazdów.

**Odpowiedź:**
```json
{
  "data": [
    {"marka": "TOYOTA"},
    {"marka": "BMW"}
  ]
}
```

#### GET /slowniki/modele
Pobiera listę modeli.

**Parametry:**
- `marka` (opcjonalny): Filtrowanie po marce

#### GET /slowniki/wojewodztwa
Pobiera listę województw.

#### GET /pojazdy
Wyszukuje pojazdy według kryteriów.

**Parametry:**
- `marka`: Marka pojazdu
- `model`: Model pojazdu
- `rok-produkcji-od`: Rok produkcji od
- `rok-produkcji-do`: Rok produkcji do
- `data-pierwszej-rejestracji-od`: Data rejestracji od (YYYY-MM-DD)
- `data-pierwszej-rejestracji-do`: Data rejestracji do (YYYY-MM-DD)
- `wojewodztwo`: Województwo
- `page`: Numer strony
- `limit`: Liczba wyników (max 500)

### Obsługa błędów

Aplikacja obsługuje:
- Błędy połączenia z API
- Timeout połączenia
- Nieprawidłowe odpowiedzi
- Brak danych

## Rozwój

### Testowanie

```bash
# Test połączenia z API
python test_api.py
```

### Struktura testów
```python
# test_api.py testuje:
1. Pobieranie marek
2. Pobieranie województw
3. Pobieranie modeli
4. Wyszukiwanie pojazdów
5. Konwersję do DataFrame
```

### Dodawanie nowych funkcji

#### Dodanie nowego filtru

1. W `app.py` dodaj widget Streamlit:
```python
new_filter = st.sidebar.selectbox("Nowy filtr", options)
```

2. W `cepik_api.py` dodaj parametr do metody:
```python
def search_vehicles(self, ..., new_param=None):
    if new_param:
        params['new_param'] = new_param
```

#### Dodanie nowej wizualizacji

```python
# W app.py po sekcji wykresów
fig = px.scatter(df, x='column1', y='column2')
st.plotly_chart(fig, use_container_width=True)
```

### Debugowanie

#### Włączenie trybu debug Streamlit
```bash
streamlit run app.py --logger.level=debug
```

#### Logi API
Dodaj do `cepik_api.py`:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Optymalizacja

#### Cache dla API
Używaj `@st.cache_data` dla często wywoływanych funkcji:
```python
@st.cache_data(ttl=3600)
def get_cached_brands():
    return api.get_brands()
```

## Przyszłe rozszerzenia

### Planowane funkcje
- [ ] Zaawansowane filtry (typ paliwa, pojemność silnika)
- [ ] Więcej wizualizacji (mapy, trendy czasowe)
- [ ] Porównywanie pojazdów
- [ ] Historia wyszukiwań
- [ ] Eksport do Excel/PDF
- [ ] Autentykacja użytkowników
- [ ] Panel administracyjny

### API rozszerzenia
- [ ] Cache wyników
- [ ] Paginacja zaawansowana
- [ ] Batch queries
- [ ] Websockets dla live updates

## Licencja

Dane pochodzą z publicznego API CEPiK udostępnionego przez Ministerstwo Cyfryzacji.

## Wsparcie

W razie problemów sprawdź:
1. Czy API CEPiK jest dostępne: https://api.cepik.gov.pl/doc
2. Czy wszystkie zależności są zainstalowane
3. Czy wirtualne środowisko jest aktywowane
4. Logi w terminalu Streamlit

## Autorzy

Aplikacja stworzona z wykorzystaniem Streamlit i API CEPiK.


