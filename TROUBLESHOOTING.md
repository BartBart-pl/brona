# 🔧 Rozwiązywanie Problemów - CEPiK App

## Najczęstsze Problemy i Rozwiązania

### 1. ❌ Błąd SSL: "DH_KEY_TOO_SMALL"

**Problem:**
```
SSLError: [SSL: DH_KEY_TOO_SMALL] dh key too small
```

**Rozwiązanie:**
✅ Ten problem został naprawiony w pliku `cepik_api.py`

**Upewnij się że:**
1. Masz najnowszą wersję `cepik_api.py` (z klasą `DESAdapter`)
2. Zainstalowano `urllib3>=1.26.0`

**Reinstalacja:**
```bash
cd /Users/bartlomiej.bartczak/Work/cepik
rm -rf env/
./setup.sh
./run.sh
```

---

### 2. ❌ Błąd parsowania: KeyError podczas pobierania danych

**Problem:**
```
KeyError: 'wojewodztwo'
KeyError: 'marka'
```

**Rozwiązanie:**
✅ Ten problem został naprawiony - dodano obsługę różnych struktur danych

**Kod automatycznie:**
- Próbuje różnych możliwych kluczy danych
- Używa fallback list gdy API nie odpowiada
- Obsługuje błędy gracefully

**Test:**
```bash
source env/bin/activate
python debug_api.py
```

To pokaże dokładną strukturę danych zwracaną przez API.

---

### 3. ⚠️ Aplikacja nie uruchamia się

**Problem:**
```
streamlit: command not found
```

**Rozwiązanie:**
```bash
# Aktywuj środowisko
source env/bin/activate

# Sprawdź czy Streamlit jest zainstalowany
pip list | grep streamlit

# Jeśli nie ma, zainstaluj
pip install -r requirements.txt
```

---

### 4. 🔌 Błąd połączenia z API

**Problem:**
```
ConnectionError: Failed to establish connection
```

**Rozwiązania:**

1. **Sprawdź połączenie internetowe**
```bash
ping api.cepik.gov.pl
```

2. **Sprawdź czy API działa**
```bash
curl -I https://api.cepik.gov.pl/doc
```

3. **Uruchom debug**
```bash
source env/bin/activate
python debug_api.py
```

---

### 5. ⏱️ Timeout podczas wyszukiwania

**Problem:**
```
Przekroczono limit czasu oczekiwania na odpowiedź
```

**Rozwiązania:**

1. **Ogranicz zakres wyszukiwania** - użyj mniejszego zakresu lat
2. **Zmniejsz limit wyników** - w kodzie parametr `limit=100` zamiast 500
3. **Sprawdź połączenie** - API może być czasowo niedostępne

**Edycja timeoutu w `cepik_api.py`:**
```python
response = self.session.get(url, params=params, timeout=60)  # zwiększ z 30 do 60
```

---

### 6. 📊 Brak wyników wyszukiwania

**Problem:**
```
ℹ️ Nie znaleziono pojazdów spełniających podane kryteria
```

**Rozwiązania:**

1. **Rozszerz zakres lat** - może być za wąski
2. **Usuń model** - zostaw tylko markę
3. **Usuń województwo** - szukaj we wszystkich
4. **Sprawdź pisownię** - wielkie/małe litery mogą mieć znaczenie

**Przykład działającego zapytania:**
- Rok produkcji: 2010-2024
- Bez marki
- Bez modelu
- Bez województwa

---

### 7. 🐍 Błąd Python: ModuleNotFoundError

**Problem:**
```
ModuleNotFoundError: No module named 'streamlit'
```

**Rozwiązanie:**
```bash
# Upewnij się że środowisko jest aktywne
source env/bin/activate

# Jeśli widzisz (env) przed promptem, środowisko jest aktywne

# Reinstaluj zależności
pip install -r requirements.txt
```

---

### 8. 🔄 Aplikacja się nie odświeża

**Problem:**
Zmiany w kodzie nie są widoczne

**Rozwiązania:**

1. **Kliknij "Rerun"** w prawym górnym rogu Streamlit
2. **Naciśnij "R"** w przeglądarce (gdy Streamlit jest aktywny)
3. **Restart aplikacji:**
```bash
# Ctrl+C w terminalu
# Następnie:
streamlit run app.py
```

---

### 9. 📦 Błąd podczas instalacji pakietów

**Problem:**
```
ERROR: Could not install packages
```

**Rozwiązania:**

1. **Zaktualizuj pip:**
```bash
source env/bin/activate
pip install --upgrade pip
```

2. **Zainstaluj pojedyncze pakiety:**
```bash
pip install streamlit==1.28.1
pip install requests==2.31.0
pip install pandas
pip install plotly==5.17.0
pip install python-dotenv==1.0.0
pip install urllib3>=1.26.0
```

3. **Użyj --no-cache-dir:**
```bash
pip install -r requirements.txt --no-cache-dir
```

---

### 10. 🌐 Port 8501 jest zajęty

**Problem:**
```
OSError: [Errno 48] Address already in use
```

**Rozwiązania:**

1. **Użyj innego portu:**
```bash
streamlit run app.py --server.port 8502
```

2. **Zabij proces na porcie 8501:**
```bash
lsof -ti:8501 | xargs kill -9
```

---

## 🔍 Narzędzia Diagnostyczne

### Debug API
```bash
source env/bin/activate
python debug_api.py
```
Pokazuje dokładną strukturę danych z API.

### Test API
```bash
source env/bin/activate
python test_api.py
```
Testuje wszystkie funkcje API.

### Sprawdź środowisko
```bash
source env/bin/activate
pip list
python --version
```

### Logi Streamlit
```bash
streamlit run app.py --logger.level=debug
```

---

## 📞 Dalsze Kroki

Jeśli problem nadal występuje:

1. **Uruchom debug:**
```bash
python debug_api.py > debug_output.txt 2>&1
```

2. **Sprawdź logi** w `debug_output.txt`

3. **Sprawdź dokumentację API:** https://api.cepik.gov.pl/doc

4. **Reinstalacja projektu:**
```bash
cd /Users/bartlomiej.bartczak/Work/cepik
rm -rf env/
./setup.sh
./run.sh
```

---

## ✅ Checklist Rozwiązywania Problemów

Przed zgłoszeniem problemu, sprawdź:

- [ ] Środowisko jest aktywne (`source env/bin/activate`)
- [ ] Wszystkie pakiety zainstalowane (`pip list`)
- [ ] Połączenie internetowe działa
- [ ] API CEPiK jest dostępne
- [ ] Najnowsza wersja plików
- [ ] Uruchomiono `debug_api.py`
- [ ] Sprawdzono logi w terminalu
- [ ] Spróbowano reinstalacji

---

## 🚀 Szybkie Komendy

```bash
# Pełna reinstalacja
rm -rf env/ && ./setup.sh && ./run.sh

# Debug
source env/bin/activate && python debug_api.py

# Test
source env/bin/activate && python test_api.py

# Uruchom z debugowaniem
source env/bin/activate && streamlit run app.py --logger.level=debug

# Sprawdź środowisko
source env/bin/activate && pip list | grep -E "streamlit|requests|pandas"
```

---

**Data aktualizacji:** Październik 2025
**Status:** Wszystkie znane problemy naprawione ✅

