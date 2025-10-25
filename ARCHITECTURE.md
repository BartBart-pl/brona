# 🏗️ Architektura Aplikacji CEPiK

## Diagram Architektury

```
┌─────────────────────────────────────────────────────────────┐
│                        UŻYTKOWNIK                            │
│                      (Przeglądarka)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP (localhost:8501)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    STREAMLIT SERVER                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │               app.py (Frontend)                     │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │  • Interfejs użytkownika (UI)                │  │    │
│  │  │  • Widgety (selectbox, slider, button)       │  │    │
│  │  │  • Wyświetlanie danych (DataFrame)           │  │    │
│  │  │  • Wizualizacje (Plotly charts)              │  │    │
│  │  │  • Obsługa zdarzeń (click handlers)          │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  │                         │                           │    │
│  │                         │ wywołania funkcji         │    │
│  │                         ▼                           │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │        cepik_api.py (Backend)                │  │    │
│  │  │  ┌────────────────────────────────────────┐  │  │    │
│  │  │  │  CepikAPI Class:                       │  │  │    │
│  │  │  │  • get_brands()                        │  │  │    │
│  │  │  │  • get_models(brand)                   │  │  │    │
│  │  │  │  • get_voivodeships()                  │  │  │    │
│  │  │  │  • search_vehicles(...)                │  │  │    │
│  │  │  │  • get_vehicle_statistics(...)         │  │  │    │
│  │  │  │  • vehicles_to_dataframe(data)         │  │  │    │
│  │  │  └────────────────────────────────────────┘  │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS REST API
                         │ (requests library)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  API CEPiK (External)                        │
│              https://api.cepik.gov.pl                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Endpointy:                                         │    │
│  │  • GET /slowniki/marki                              │    │
│  │  • GET /slowniki/modele                             │    │
│  │  • GET /slowniki/wojewodztwa                        │    │
│  │  • GET /pojazdy (search)                            │    │
│  │  • GET /pojazdy/statystyki                          │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         │
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BAZA DANYCH CEPiK (Backend)                     │
│      Centralna Ewidencja Pojazdów i Kierowców                │
└─────────────────────────────────────────────────────────────┘
```

## Przepływ Danych

### 1. Inicjalizacja Aplikacji

```
User → Przeglądarka → Streamlit Server (port 8501)
                            │
                            ├─→ Ładowanie app.py
                            ├─→ Inicjalizacja CepikAPI
                            ├─→ Cache (@st.cache_resource)
                            └─→ Pobranie słowników (marki, województwa)
```

### 2. Wyszukiwanie Pojazdów

```
User
  │
  ├─→ Wypełnia formularz (marka, model, lata)
  │
  └─→ Klika "Szukaj"
       │
       ├─→ app.py: Walidacja danych
       │
       ├─→ cepik_api.py: search_vehicles()
       │    │
       │    ├─→ Budowanie parametrów zapytania
       │    │
       │    └─→ HTTP GET → api.cepik.gov.pl/pojazdy
       │                        │
       │                        └─→ JSON Response
       │
       ├─→ cepik_api.py: vehicles_to_dataframe()
       │    │
       │    └─→ Konwersja JSON → Pandas DataFrame
       │
       └─→ app.py: Wyświetlenie wyników
            │
            ├─→ Metryki (st.metric)
            ├─→ Tabela (st.dataframe)
            ├─→ Wykresy (plotly charts)
            └─→ Przycisk eksportu (CSV)
```

### 3. Eksport Danych

```
User
  │
  └─→ Klika "Pobierz CSV"
       │
       ├─→ DataFrame.to_csv()
       │
       └─→ st.download_button()
            │
            └─→ Browser Download (plik CSV)
```

## Komponenty Systemu

### Frontend Layer (app.py)
**Odpowiedzialność:**
- Interfejs użytkownika
- Interakcje użytkownika
- Wyświetlanie danych
- Wizualizacje

**Technologie:**
- Streamlit (UI framework)
- Plotly (wykresy)
- Pandas (DataFrame display)

### Backend Layer (cepik_api.py)
**Odpowiedzialność:**
- Komunikacja z API
- Transformacja danych
- Obsługa błędów
- Cache'owanie

**Technologie:**
- Requests (HTTP client)
- Pandas (data processing)
- Python Session (connection pooling)

### Configuration Layer (config.py)
**Odpowiedzialność:**
- Centralna konfiguracja
- Zmienne środowiskowe
- Stałe aplikacji

**Technologie:**
- python-dotenv
- os.environ

### External API (CEPiK)
**Odpowiedzialność:**
- Przechowywanie danych
- Udostępnianie danych
- Autentykacja/Autoryzacja

**Format:**
- REST API
- JSON responses
- Query parameters

## Wzorce Projektowe

### 1. Separation of Concerns
```python
app.py          → Prezentacja (View)
cepik_api.py    → Logika biznesowa (Controller)
API CEPiK       → Dane (Model)
```

### 2. Singleton Pattern
```python
@st.cache_resource
def init_api():
    return CepikAPI()  # Jedna instancja dla całej sesji
```

### 3. Facade Pattern
```python
class CepikAPI:
    # Uproszczony interfejs do skomplikowanego API
    def search_vehicles(self, ...):
        # Ukrywa złożoność budowania URL i parametrów
```

### 4. Data Transfer Object
```python
def vehicles_to_dataframe(self, data: Dict) -> pd.DataFrame:
    # Konwersja między formatami danych
```

## Bezpieczeństwo

### Walidacja Input
```python
# Walidacja zakresów dat
if production_year_from > production_year_to:
    st.error("Nieprawidłowy zakres")
```

### Obsługa Błędów
```python
try:
    response = self.session.get(url)
    response.raise_for_status()
except requests.exceptions.RequestException as e:
    return {'error': str(e)}
```

### HTTPS
```python
BASE_URL = "https://api.cepik.gov.pl"  # Bezpieczne połączenie
```

### Rate Limiting
```python
# Limit wyników
limit: int = 100  # Max 500
```

## Skalowanie

### Optymalizacja Wydajności

1. **Cache API Calls**
```python
@st.cache_data(ttl=3600)
def get_cached_brands():
    return api.get_brands()
```

2. **Lazy Loading**
```python
# Modele ładowane tylko gdy wybrano markę
if selected_brand:
    models = api.get_models(selected_brand)
```

3. **Pagination**
```python
page: int = 1
limit: int = 100  # Kontrola rozmiaru odpowiedzi
```

4. **Connection Pooling**
```python
self.session = requests.Session()
# Ponowne użycie połączeń HTTP
```

## Monitoring i Logging

### Aktualnie zaimplementowane:
```python
print(f"Błąd podczas pobierania: {e}")
```

### Możliwe rozszerzenia:
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
logger.info("API call successful")
logger.error(f"API error: {e}")
```

## Testy

### Struktura testów (test_api.py):
```
Test Suite
├─ Test 1: Pobieranie marek
├─ Test 2: Pobieranie województw
├─ Test 3: Pobieranie modeli
├─ Test 4: Wyszukiwanie pojazdów
└─ Test 5: Konwersja do DataFrame
```

## Deployment

### Lokalne (obecne):
```bash
streamlit run app.py
```

### Możliwe platformy:
- Streamlit Cloud (streamlit.io)
- Heroku
- AWS EC2
- Google Cloud Run
- Azure App Service

## Rozszerzenia

### Planowane funkcje:
1. **Database Cache**: Redis/SQLite dla cache'u
2. **User Authentication**: Login system
3. **Advanced Analytics**: ML predictions
4. **Real-time Updates**: WebSockets
5. **Multi-language**: i18n support
6. **API Key Management**: Secure storage
7. **Background Jobs**: Celery for async tasks
8. **Monitoring**: Prometheus + Grafana

## Zalety Architektury

✅ **Modularność**: Oddzielenie UI od logiki biznesowej
✅ **Testowalność**: Łatwe testowanie poszczególnych warstw
✅ **Skalowalność**: Możliwość dodawania nowych funkcji
✅ **Utrzymywalność**: Czysty kod, dobrze udokumentowany
✅ **Bezpieczeństwo**: Walidacja, obsługa błędów
✅ **Wydajność**: Cache, lazy loading, connection pooling

## Dokumentacja Techniczna

- `app.py`: 300+ linii, UI layer
- `cepik_api.py`: 200+ linii, Business logic
- `config.py`: 50+ linii, Configuration
- `test_api.py`: 100+ linii, Testing

**Łącznie**: ~650+ linii kodu Python


