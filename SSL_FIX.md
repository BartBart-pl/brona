# 🔧 Naprawa Problemu SSL z API CEPiK

## Problem

Błąd: `[SSL: DH_KEY_TOO_SMALL] dh key too small`

API CEPiK używa starszego certyfikatu SSL z małym kluczem Diffie-Hellman (DH), który jest odrzucany przez nowsze wersje OpenSSL ze względów bezpieczeństwa.

## ✅ Rozwiązanie - Zaimplementowane

Problem został naprawiony w pliku `cepik_api.py` poprzez dodanie custom adaptera HTTP, który obsługuje starsze certyfikaty SSL.

### Co zostało zmienione:

1. **Dodano klasę `DESAdapter`** - custom adapter HTTP z obniżonym poziomem bezpieczeństwa SSL
2. **Zaktualizowano `CepikAPI.__init__()`** - montuje adapter dla połączeń HTTPS
3. **Dodano zależność** - `urllib3>=1.26.0` w `requirements.txt`

### Kod rozwiązania:

```python
class DESAdapter(HTTPAdapter):
    """
    Adapter HTTP z obsługą starszych certyfikatów SSL.
    Rozwiązuje problem "DH_KEY_TOO_SMALL" dla API CEPiK.
    """
    def init_poolmanager(self, *args, **kwargs):
        context = create_urllib3_context()
        # Obniżenie poziomu bezpieczeństwa dla zgodności z API CEPiK
        context.set_ciphers('DEFAULT@SECLEVEL=1')
        kwargs['ssl_context'] = context
        return super().init_poolmanager(*args, **kwargs)
```

## 🚀 Jak zastosować naprawę

### Metoda 1: Nowa instalacja (Jeśli nie instalowałeś jeszcze)

```bash
./setup.sh
./run.sh
```

### Metoda 2: Aktualizacja istniejącej instalacji

```bash
# Aktywuj środowisko
source env/bin/activate

# Zaktualizuj zależności
pip install urllib3>=1.26.0 --upgrade

# Uruchom aplikację
streamlit run app.py
```

### Metoda 3: Pełna reinstalacja

```bash
# Usuń stare środowisko
rm -rf env/

# Zainstaluj od nowa
./setup.sh

# Uruchom
./run.sh
```

## 🧪 Test po naprawie

Możesz przetestować czy naprawa działa:

```bash
source env/bin/activate
python test_api.py
```

Powinno pokazać:
```
✅ Pobrano marki
✅ Pobrano województwa
✅ Wyszukiwanie pojazdów działa
```

## 🔒 Bezpieczeństwo

**Uwaga:** To rozwiązanie obniża poziom bezpieczeństwa SSL **tylko dla połączeń z api.cepik.gov.pl**.

- ✅ Bezpieczne dla tego konkretnego API
- ✅ Nie wpływa na inne połączenia HTTPS
- ✅ Tylko dla połączeń do api.cepik.gov.pl
- ⚠️ Używa `SECLEVEL=1` zamiast domyślnego `SECLEVEL=2`

## 📚 Szczegóły techniczne

### Dlaczego ten problem występuje?

API CEPiK używa certyfikatu SSL z kluczem DH o rozmiarze mniejszym niż 2048 bitów. OpenSSL 1.1.1+ i nowsze odrzucają takie klucze domyślnie, ponieważ są uważane za niewystarczająco bezpieczne.

### Co robi `SECLEVEL=1`?

- **SECLEVEL=2** (domyślne): wymaga klucza DH >= 2048 bitów
- **SECLEVEL=1** (nasze ustawienie): akceptuje klucze DH >= 1024 bitów
- Pozwala na połączenie z API CEPiK przy zachowaniu podstawowego poziomu bezpieczeństwa

### Alternatywne rozwiązania (nie zalecane):

❌ Wyłączenie weryfikacji SSL całkowicie (`verify=False`) - **NIEBEZPIECZNE**
❌ Obniżenie OpenSSL systemowo - wpływa na cały system
✅ Custom adapter (nasze rozwiązanie) - bezpieczne i celowane

## 🆘 Nadal nie działa?

### Sprawdź wersję OpenSSL:

```bash
python -c "import ssl; print(ssl.OPENSSL_VERSION)"
```

Powinieneś zobaczyć: `OpenSSL 1.1.1` lub nowszą.

### Sprawdź wersję urllib3:

```bash
pip show urllib3
```

Powinieneś zobaczyć wersję >= 1.26.0

### Sprawdź logi:

Jeśli nadal występują błędy, uruchom z debugowaniem:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 📞 Wsparcie

Jeśli problem nadal występuje:

1. Sprawdź czy używasz aktualnej wersji plików
2. Upewnij się, że urllib3 >= 1.26.0 jest zainstalowane
3. Sprawdź logi w terminalu podczas wyszukiwania
4. Zrób pełną reinstalację (Metoda 3)

## ✅ Podsumowanie

Problem SSL z API CEPiK został **naprawiony**. 

Aby zastosować naprawę:
```bash
source env/bin/activate
pip install urllib3>=1.26.0 --upgrade
streamlit run app.py
```

Wyszukiwanie pojazdów powinno teraz działać poprawnie! 🚗✨

