# 🚀 Deployment BRONA na Render.com

## Krok po kroku - Deployment aplikacji Streamlit

### 1. Przygotowanie repozytorium

✅ Repozytorium już zawiera wszystkie wymagane pliki:
- `Procfile` - komenda uruchomieniowa dla Render
- `requirements.txt` - zależności Python
- `.streamlit/config.toml` - konfiguracja Streamlit
- `app.py` - główna aplikacja
- `cepik_api.py` - moduł API

### 2. Utworzenie konta na Render

1. Przejdź do https://render.com
2. Zarejestruj się (możesz użyć GitHub)
3. Połącz swoje konto GitHub z Render

### 3. Utworzenie Web Service

1. W dashboard Render kliknij **"New +"** → **"Web Service"**

2. Połącz repozytorium:
   - Wybierz **"Connect a repository"**
   - Wybierz repozytorium: `BartBart-pl/brona`
   - Kliknij **"Connect"**

3. Skonfiguruj Web Service:
   ```
   Name:              brona
   Region:            Frankfurt (EU Central) lub najbliższy
   Branch:            main
   Root Directory:    (puste)
   Runtime:           Python 3
   Build Command:     pip install -r requirements.txt
   Start Command:     (zostaw puste - Render użyje Procfile)
   ```

4. **Plan:**
   - Wybierz **"Free"** (lub wyższy plan jeśli potrzebujesz)
   - Free plan: 750 godzin/miesiąc, usypia po 15 min nieaktywności

5. Kliknij **"Create Web Service"**

### 4. Zmienne środowiskowe (opcjonalne)

Jeśli potrzebujesz dodać zmienne środowiskowe:

1. W Web Service przejdź do **"Environment"**
2. Dodaj zmienne (np. `PYTHON_VERSION=3.11.0`)

### 5. Deploy

Render automatycznie:
1. Sklonuje repozytorium
2. Zainstaluje zależności z `requirements.txt`
3. Uruchomi aplikację zgodnie z `Procfile`

**Pierwsze uruchomienie zajmie 5-10 minut.**

### 6. Weryfikacja

Po zakończeniu deployment:

1. Render wyświetli URL: `https://brona.onrender.com` (lub podobny)
2. Kliknij w URL aby otworzyć aplikację
3. Aplikacja powinna się uruchomić i wyświetlić interfejs BRONA

## 📋 Checklist przed deployment

- [x] Procfile utworzony
- [x] requirements.txt zaktualizowany
- [x] .streamlit/config.toml skonfigurowany
- [x] Kod wypchany do GitHub
- [ ] Konto Render utworzone
- [ ] Repozytorium połączone z Render
- [ ] Web Service utworzony

## ⚙️ Szczegóły techniczne

### Procfile

```
web: streamlit run app.py --server.port=$PORT --server.address=0.0.0.0 --server.headless=true
```

- `web:` - typ procesu (Web Service)
- `--server.port=$PORT` - Render przypisuje dynamiczny port
- `--server.address=0.0.0.0` - nasłuchuj na wszystkich interfejsach
- `--server.headless=true` - tryb produkcyjny (bez auto-reload)

### Python Version

Domyślnie Render używa Python 3.7. Aby zmienić:

1. Dodaj plik `runtime.txt` w głównym katalogu:
   ```
   python-3.11.0
   ```

2. Lub ustaw zmienną środowiskową:
   ```
   PYTHON_VERSION=3.11.0
   ```

### Konfiguracja Streamlit

Plik `.streamlit/config.toml` zawiera:
- `headless = true` - tryb produkcyjny
- `enableCORS = false` - wyłączone CORS (Render obsługuje to)
- `maxUploadSize = 200` - maksymalny rozmiar uploadu (MB)

## 🔄 Aktualizacje

Aby zaktualizować aplikację:

1. Wprowadź zmiany w kodzie
2. Commit i push do GitHub:
   ```bash
   git add .
   git commit -m "Update aplikacji"
   git push origin main
   ```
3. Render automatycznie wykryje zmiany i zrobi redeploy

## 💰 Koszty

### Free Plan
- ✅ 750 godzin/miesiąc
- ✅ Unlimited inbound data transfer
- ⚠️ Usypia po 15 min nieaktywności
- ⚠️ Pierwsze uruchomienie po uśpieniu trwa ~1 min

### Starter Plan ($7/mies)
- ✅ Always-on (nie usypia)
- ✅ Szybsze uruchomienie
- ✅ Więcej pamięci RAM

### Production Plan ($25/mies+)
- ✅ Scaling
- ✅ Custom domains
- ✅ Priority support

## 🐛 Troubleshooting

### Aplikacja nie startuje

**Problem:** Build failed  
**Rozwiązanie:**
- Sprawdź logi w Render Dashboard → Logs
- Zweryfikuj `requirements.txt`
- Sprawdź czy wszystkie zależności są kompatybilne

**Problem:** SSL/TLS błędy z API CEPiK  
**Rozwiązanie:**
- Aplikacja automatycznie obsługuje to w `cepik_api.py` (DESAdapter)
- Sprawdź logi czy są inne błędy

### Aplikacja wolno działa

**Problem:** Free plan, aplikacja uśpiona  
**Rozwiązanie:**
- Pierwsze uruchomienie po uśpieniu trwa ~1 min
- Upgrade do Starter plan dla always-on

**Problem:** Timeout przy pobieraniu danych  
**Rozwiązanie:**
- API CEPiK może być wolne
- Zwiększ timeout w `cepik_api.py` (obecnie 30s)

### Render nie wykrywa zmian

**Problem:** Auto-deploy nie działa  
**Rozwiązanie:**
- Sprawdź czy repozytorium jest połączone
- W Render: Settings → Build & Deploy → Auto-Deploy: ON
- Manual deploy: Dashboard → Manual Deploy → Deploy latest commit

## 📚 Dodatkowe zasoby

- [Render Documentation](https://render.com/docs)
- [Streamlit on Render](https://docs.streamlit.io/knowledge-base/tutorials/deploy/render)
- [Render Community](https://community.render.com/)

## 🌐 URL aplikacji

Po deployment aplikacja będzie dostępna pod:
```
https://brona.onrender.com
```
(lub podobnym URL nadanym przez Render)

## ✅ Post-deployment

Po udanym deployment:

1. **Testuj aplikację:**
   - Sprawdź wszystkie funkcje
   - Przetestuj wyszukiwanie
   - Sprawdź pobieranie danych z API CEPiK

2. **Monitoruj logi:**
   - Render Dashboard → Logs
   - Sprawdź czy nie ma błędów

3. **Skonfiguruj custom domain (opcjonalnie):**
   - Render Settings → Custom Domains
   - Dodaj swoją domenę

4. **Backup danych:**
   - Render nie przechowuje danych trwale
   - Wszystkie dane w session state są tymczasowe

---

**Gotowe!** 🎉

Twoja aplikacja BRONA jest teraz dostępna publicznie!

