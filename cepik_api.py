"""
Moduł do komunikacji z API CEPiK
Uwaga: API CEPiK nie pozwala na bezpośrednie wyszukiwanie po marce/modelu.
Wyszukuje pojazdy po województwie i dacie, filtrowanie po marce/modelu odbywa się lokalnie.
"""
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context
from typing import Optional, Dict, List, Tuple
import pandas as pd
import ssl
import asyncio
import aiohttp
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import threading
from datetime import datetime


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


class CepikAPI:
    """Klasa do obsługi API CEPiK"""
    
    BASE_URL = "https://api.cepik.gov.pl"
    
    # Mapowanie kodów województw na nazwy
    WOJEWODZTWA_KODY = {
        '02': 'DOLNOŚLĄSKIE',
        '04': 'KUJAWSKO-POMORSKIE',
        '06': 'LUBELSKIE',
        '08': 'LUBUSKIE',
        '10': 'ŁÓDZKIE',
        '12': 'MAŁOPOLSKIE',
        '14': 'MAZOWIECKIE',
        '16': 'OPOLSKIE',
        '18': 'PODKARPACKIE',
        '20': 'PODLASKIE',
        '22': 'POMORSKIE',
        '24': 'ŚLĄSKIE',
        '26': 'ŚWIĘTOKRZYSKIE',
        '28': 'WARMIŃSKO-MAZURSKIE',
        '30': 'WIELKOPOLSKIE',
        '32': 'ZACHODNIOPOMORSKIE'
    }
    
    def __init__(self):
        self.session = requests.Session()
        
        # Dodanie custom adaptera dla obsługi starszych certyfikatów SSL
        adapter = DESAdapter()
        self.session.mount('https://', adapter)
        
        # Cache dla słowników
        self._dictionaries_cache = {}
        
        self.session.headers.update({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        })
    
    def get_dictionary(self, dictionary_name: str) -> List[str]:
        """
        Pobiera wartości ze słownika API CEPiK.
        
        Args:
            dictionary_name: Nazwa słownika (np. 'marka', 'rodzaj-pojazdu', 'rodzaj-paliwa')
        
        Returns:
            Lista wartości ze słownika
        """
        # Sprawdź cache
        if dictionary_name in self._dictionaries_cache:
            return self._dictionaries_cache[dictionary_name]
        
        try:
            response = self.session.get(
                f"{self.BASE_URL}/slowniki/{dictionary_name}",
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            
            values = []
            if 'data' in data and isinstance(data['data'], dict):
                if 'attributes' in data['data'] and 'dostepne-rekordy-slownika' in data['data']['attributes']:
                    rekordy = data['data']['attributes']['dostepne-rekordy-slownika']
                    # API używa 'klucz-slownika' (nie 'wartosc-slownika')
                    all_values = [r['klucz-slownika'] for r in rekordy if 'klucz-slownika' in r]
                    
                    # Specjalna obróbka dla sposobu produkcji - usuń wartości liczbowe
                    if dictionary_name == 'sposob-produkcji':
                        values = [v for v in all_values if not v.isdigit()]
                    else:
                        values = all_values
            
            # Cache wynik
            self._dictionaries_cache[dictionary_name] = values
            return values
            
        except Exception as e:
            print(f"Błąd podczas pobierania słownika {dictionary_name}: {e}")
            return []
    
    def get_all_dictionaries(self) -> Dict[str, List[str]]:
        """
        Pobiera wszystkie dostępne słowniki z API.
        Iteruje przez listę słowników z /slowniki i dla każdego pobiera wartości.
        
        Returns:
            Słownik {nazwa_slownika: [wartości]}
        """
        try:
            # Pobierz listę dostępnych słowników
            response = self.session.get(f"{self.BASE_URL}/slowniki?limit=100&page=1", timeout=10)
            response.raise_for_status()
            data = response.json()
            
            dictionaries = {}
            
            if 'data' in data and isinstance(data['data'], list):
                print(f"Znaleziono {len(data['data'])} słowników w API")
                
                for item in data['data']:
                    dict_id = item.get('id')
                    dict_link = item.get('links', {}).get('self')
                    
                    if not dict_id:
                        continue
                    
                    # Województwa obsługujemy osobno
                    if dict_id == 'wojewodztwa':
                        continue
                    
                    print(f"Pobieranie słownika: {dict_id} z {dict_link}")
                    
                    # Pobierz wartości dla tego słownika
                    values = self.get_dictionary(dict_id)
                    
                    if values and len(values) > 0:
                        dictionaries[dict_id] = values
                        print(f"  ✓ Pobrano {len(values)} wartości dla '{dict_id}'")
                    else:
                        print(f"  ✗ Brak wartości dla '{dict_id}'")
            
            return dictionaries
            
        except Exception as e:
            print(f"Błąd podczas pobierania listy słowników: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def get_voivodeships(self) -> List[Tuple[str, str]]:
        """
        Pobiera listę województw z API (kod, nazwa).
        Returns: Lista tupli (kod, nazwa) np. [('02', 'DOLNOŚLĄSKIE'), ...]
        """
        try:
            response = self.session.get(f"{self.BASE_URL}/slowniki/wojewodztwa", timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'data' in data and isinstance(data['data'], dict):
                if 'attributes' in data['data'] and 'dostepne-rekordy-slownika' in data['data']['attributes']:
                    rekordy = data['data']['attributes']['dostepne-rekordy-slownika']
                    return [(r['klucz-slownika'], r['wartosc-slownika']) for r in rekordy]
            
            # Fallback do zakodowanej listy
            print("Używam zakodowanej listy województw")
            return list(self.WOJEWODZTWA_KODY.items())
            
        except Exception as e:
            print(f"Błąd podczas pobierania województw: {e}")
            return list(self.WOJEWODZTWA_KODY.items())
    
    def get_voivodeship_code(self, nazwa: str) -> Optional[str]:
        """Zwraca kod województwa na podstawie nazwy"""
        nazwa_upper = nazwa.upper()
        for kod, nazwa_woj in self.WOJEWODZTWA_KODY.items():
            if nazwa_woj == nazwa_upper:
                return kod
        return None
    
    def search_vehicles(
        self,
        voivodeship_code: Optional[str] = None,
        date_from: Optional[str] = None,  # Format: YYYYMMDD
        date_to: Optional[str] = None,    # Format: YYYYMMDD
        brand: Optional[str] = None,      # Filtrowanie przez API
        model: Optional[str] = None,      # Filtrowanie przez API
        year_from: Optional[int] = None,  # Lokalne filtrowanie (API nie wspiera)
        year_to: Optional[int] = None,    # Lokalne filtrowanie (API nie wspiera)
        retry: bool = True,
        additional_filters: Optional[Dict] = None,  # Dodatkowe filtry API
        progress_callback=None  # Callback dla progress bar
    ) -> Dict:
        """
        Wyszukuje pojazdy według województwa, okresu i opcjonalnie marki/modelu.
        Pobiera WSZYSTKIE strony wyników i deduplikuje po ID.
        
        API CEPiK wspiera bezpośrednie filtrowanie przez parametry filter[klucz].
        
        Args:
            voivodeship_code: Kod województwa (np. '12' dla małopolskiego)
            date_from: Data od w formacie YYYYMMDD (np. '20240101')
            date_to: Data do w formacie YYYYMMDD (np. '20241231')
            brand: Marka do filtrowania (filtrowanie przez API)
            model: Model do filtrowania (filtrowanie przez API)
            year_from: Rok produkcji od (lokalne filtrowanie)
            year_to: Rok produkcji do (lokalne filtrowanie)
            additional_filters: Dodatkowe filtry API (dict: {'rodzaj-pojazdu': 'SAMOCHÓD OSOBOWY', ...})
            progress_callback: Opcjonalna funkcja callback(current_page, total_count, fetched_count)
        """
        try:
            # Walidacja wymaganych parametrów
            if not voivodeship_code:
                return {'data': [], 'error': 'Wybierz województwo'}
            
            if not date_from or not date_to:
                return {'data': [], 'error': 'Wybierz zakres dat'}
            
            url = f"{self.BASE_URL}/pojazdy"
            params = {
                'wojewodztwo': voivodeship_code,
                'data-od': date_from,
                'data-do': date_to,
                'limit': 500,  # Max na stronę (API limit)
                'page': 1
            }
            
            # Filtrowanie przez API (o wiele szybsze!)
            if brand:
                params['filter[marka]'] = brand.upper()
            
            if model:
                params['filter[model]'] = model.upper()
            
            # Dodatkowe filtry API
            if additional_filters:
                for key, value in additional_filters.items():
                    if value and key not in ['marka', 'model']:  # marka i model już obsłużone
                        params[f'filter[{key}]'] = value.upper() if isinstance(value, str) else value
            
            # Pobierz wszystkie strony
            all_vehicles = []
            seen_ids = set()  # Do deduplicacji
            current_page = 1
            total_count = 0
            
            while True:
                params['page'] = current_page
                
                # Wykonaj zapytanie z retry
                try:
                    response = self.session.get(url, params=params, timeout=30)
                    response.raise_for_status()
                    result = response.json()
                except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
                    # Retry raz jeśli włączone
                    if retry:
                        time.sleep(1)
                        try:
                            response = self.session.get(url, params=params, timeout=30)
                            response.raise_for_status()
                            result = response.json()
                        except Exception:
                            raise e  # Zwróć pierwotny błąd
                    else:
                        raise e
                
                # Pobierz informacje o paginacji
                if 'meta' in result and 'count' in result['meta']:
                    total_count = result['meta']['count']
                
                # Dodaj pojazdy z deduplicacją po ID
                if 'data' in result and isinstance(result['data'], list):
                    for vehicle in result['data']:
                        vehicle_id = vehicle.get('id')
                        if vehicle_id and vehicle_id not in seen_ids:
                            seen_ids.add(vehicle_id)
                            all_vehicles.append(vehicle)
                
                # Wywołaj callback jeśli jest
                if progress_callback:
                    progress_callback(current_page, total_count, len(all_vehicles))
                
                # Sprawdź czy są kolejne strony
                if 'links' in result and 'next' in result['links'] and result['links']['next']:
                    current_page += 1
                else:
                    break  # Koniec stron
            
            # Lokalne filtrowanie po roku produkcji (API nie wspiera tego bezpośrednio)
            if year_from or year_to:
                filtered = []
                for v in all_vehicles:
                    if 'attributes' in v and 'rok-produkcji' in v['attributes']:
                        try:
                            year = int(v['attributes']['rok-produkcji'])
                            if year_from and year < year_from:
                                continue
                            if year_to and year > year_to:
                                continue
                            filtered.append(v)
                        except (ValueError, TypeError):
                            continue
                all_vehicles = filtered
            
            return {
                'data': all_vehicles,
                'meta': {
                    'total_count': total_count,
                    'fetched_count': len(all_vehicles),
                    'pages_fetched': current_page
                }
            }
            
        except requests.exceptions.Timeout as e:
            return {'data': [], 'error': 'Przekroczono limit czasu oczekiwania (30s). Spróbuj mniejszy zakres dat.'}
        except requests.exceptions.SSLError as e:
            return {'data': [], 'error': 'Błąd SSL - problem z certyfikatem API'}
        except requests.exceptions.RequestException as e:
            return {'data': [], 'error': f'Błąd połączenia: {str(e)}'}
        except Exception as e:
            return {'data': [], 'error': f'Nieoczekiwany błąd: {str(e)}'}
    
    def get_brands_from_data(self, vehicles: List[Dict]) -> List[str]:
        """
        Pobiera unikalne marki z pobranych danych pojazdów.
        """
        brands = set()
        for vehicle in vehicles:
            if 'attributes' in vehicle and 'marka' in vehicle['attributes']:
                brand = vehicle['attributes']['marka']
                if brand and brand != '---':
                    brands.add(brand)
        return sorted(list(brands))
    
    def get_models_from_data(self, vehicles: List[Dict], brand: Optional[str] = None) -> List[str]:
        """
        Pobiera unikalne modele z pobranych danych pojazdów.
        Opcjonalnie filtruje po marce.
        """
        models = set()
        for vehicle in vehicles:
            if 'attributes' in vehicle:
                attrs = vehicle['attributes']
                if brand and attrs.get('marka', '').upper() != brand.upper():
                    continue
                model = attrs.get('model', '')
                if model and model != '---':
                    models.add(model)
        return sorted(list(models))
    
    def normalize_model_name(self, marka: str, model: str) -> str:
        """
        Usuwa nazwę marki z modelu jeśli model zaczyna się od marki.
        Przykład: marka='TOYOTA', model='TOYOTA CAMRY' -> 'CAMRY'
        """
        if not marka or not model:
            return model
        
        # Konwertuj na wielkie litery dla porównania
        marka_upper = marka.upper().strip()
        model_upper = model.upper().strip()
        
        # Sprawdź czy model zaczyna się od marki
        if model_upper.startswith(marka_upper):
            # Usuń markę z początku
            normalized = model[len(marka):].strip()
            # Usuń ewentualne myślniki/spacje z początku
            normalized = normalized.lstrip('- ')
            return normalized if normalized else model
        
        return model
    
    def vehicles_to_dataframe(self, vehicles_data: Dict) -> pd.DataFrame:
        """
        Konwertuje dane pojazdów do pandas DataFrame.
        Parsuje kody województw na nazwy.
        Normalizuje nazwy modeli (usuwa markę z modelu).
        Konwertuje kolumny numeryczne na odpowiednie typy.
        Zachowuje _batch_id dla śledzenia źródła danych.
        """
        if 'data' in vehicles_data and vehicles_data['data']:
            # Wypakuj attributes z każdego pojazdu
            records = []
            for vehicle in vehicles_data['data']:
                if 'attributes' in vehicle:
                    record = vehicle['attributes'].copy()
                    record['id'] = vehicle.get('id', '')
                    
                    # Zachowaj batch_id jeśli istnieje
                    if '_batch_id' in vehicle:
                        record['_batch_id'] = vehicle['_batch_id']
                    
                    # Zamień kod województwa na nazwę
                    if 'wojewodztwo-kod' in record:
                        kod = record['wojewodztwo-kod']
                        record['wojewodztwo'] = self.WOJEWODZTWA_KODY.get(kod, kod)
                    
                    # Normalizuj nazwę modelu (usuń markę z modelu)
                    if 'marka' in record and 'model' in record:
                        record['model'] = self.normalize_model_name(record['marka'], record['model'])
                    
                    records.append(record)
            
            if records:
                df = pd.DataFrame(records)
                
                # Konwertuj kolumny numeryczne
                numeric_columns = [
                    'pojemnosc-skokowa-silnika',
                    'masa-wlasna',
                    'rok-produkcji',
                    'liczba-miejsc-siedzacych',
                    'masa-calkowita',
                    'dopuszczalna-ladownosc',
                    'liczba-osi'
                ]
                
                for col in numeric_columns:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')
                
                return df
        
        return pd.DataFrame()
    
    def search_all_voivodeships_parallel(
        self,
        date_from: str,
        date_to: str,
        brand: Optional[str] = None,
        model: Optional[str] = None,
        year_from: Optional[int] = None,
        year_to: Optional[int] = None,
        progress_callback=None,
        additional_filters: Optional[Dict] = None
    ) -> Tuple[List[Dict], List[str], Dict]:
        """
        Przeszukuje wszystkie województwa równolegle z retry i obsługą rate limiting.
        Pobiera WSZYSTKIE wyniki (bez limitu).
        
        Returns: (all_vehicles, errors, statuses_dict)
            statuses_dict: {code: {'name': str, 'status': str, 'count': int, 'pages': int, 'error': str, 'time': float}}
        """
        all_vehicles = []
        errors = []
        voiv_codes = list(self.WOJEWODZTWA_KODY.keys())
        seen_ids = set()  # Globalna deduplicacja między województwami
        
        # Rate limiting
        rate_limit_event = threading.Event()
        rate_limit_event.set()  # Initially not blocked
        rate_limit_lock = threading.Lock()
        statuses = {}  # Szczegółowe statusy dla każdego województwa
        
        # Throttling - minimalny odstęp między zapytaniami
        last_request_time = {'time': 0}
        request_lock = threading.Lock()
        MIN_REQUEST_INTERVAL = 2.5  # sekund między zapytaniami (zwiększone dla stabilności)
        
        def check_rate_limit(response):
            """Sprawdź czy API zwróciło błąd rate limiting"""
            try:
                status = response.status_code
                
                if status in [429, 503]:
                    print(f"[DEBUG] Rate limit detected: status {status}")
                    return True
                    
                # Możliwe inne wskaźniki rate limiting
                if 'X-RateLimit-Remaining' in response.headers:
                    remaining = int(response.headers.get('X-RateLimit-Remaining', 1))
                    if remaining <= 5:  # Ostrzeżenie gdy zostało mało requestów
                        print(f"[DEBUG] X-RateLimit-Remaining low: {remaining}")
                    if remaining <= 0:
                        print(f"[DEBUG] Rate limit detected: remaining={remaining}")
                        return True
                        
                return False
            except Exception as e:
                print(f"[DEBUG] Error in check_rate_limit: {e}")
                return False
        
        def fetch_voivodeship(code):
            voiv_name = self.WOJEWODZTWA_KODY.get(code, code)
            start_time = time.time()
            
            # Zaktualizuj start_time (status już jest zainicjalizowany)
            with rate_limit_lock:
                statuses[code]['start_time'] = start_time
            
            try:
                # Czekaj jeśli jest rate limit
                rate_limit_event.wait()
                
                with rate_limit_lock:
                    statuses[code]['status'] = '🔄 Pobieranie...'
                
                # Własna implementacja z obsługą rate limiting
                url = f"{self.BASE_URL}/pojazdy"
                params = {
                    'wojewodztwo': code,
                    'data-od': date_from,
                    'data-do': date_to,
                    'limit': 500,
                    'page': 1
                }
                
                if brand:
                    params['filter[marka]'] = brand.upper()
                if model:
                    params['filter[model]'] = model.upper()
                if additional_filters:
                    for key, value in additional_filters.items():
                        if value and key not in ['marka', 'model']:
                            params[f'filter[{key}]'] = value.upper() if isinstance(value, str) else value
                
                vehicles_data = []
                current_page = 1
                
                while True:
                    params['page'] = current_page
                    
                    # Czekaj jeśli jest rate limit
                    rate_limit_event.wait()
                    
                    # Throttling - odczekaj minimalny czas od ostatniego zapytania
                    with request_lock:
                        current_time = time.time()
                        time_since_last = current_time - last_request_time['time']
                        if time_since_last < MIN_REQUEST_INTERVAL:
                            sleep_time = MIN_REQUEST_INTERVAL - time_since_last
                            time.sleep(sleep_time)
                        last_request_time['time'] = time.time()
                    
                    response = self.session.get(url, params=params, timeout=30)
                    
                    # Sprawdź rate limiting
                    if check_rate_limit(response):
                        with rate_limit_lock:
                            if rate_limit_event.is_set():  # Tylko pierwszy wątek blokuje
                                rate_limit_event.clear()
                                statuses[code]['status'] = '⚠️ Rate limit - czekam 15s...'
                                
                                # Zaktualizuj wszystkie statusy
                                for c in statuses:
                                    if statuses[c]['status'] not in ['✅ Ukończono', '❌ Błąd']:
                                        statuses[c]['status'] = '⏸️ Wstrzymano (rate limit)'
                        
                        # Odczekaj 15 sekund (zmniejszone z 30s)
                        time.sleep(15)
                        
                        with rate_limit_lock:
                            rate_limit_event.set()
                            statuses[code]['status'] = '🔄 Wznawianie...'
                        
                        # Retry request
                        continue
                    
                    response.raise_for_status()
                    result = response.json()
                    
                    if 'data' in result and result['data']:
                        vehicles_data.extend(result['data'])
                        
                        with rate_limit_lock:
                            statuses[code]['count'] = len(vehicles_data)
                            statuses[code]['pages'] = current_page
                            statuses[code]['status'] = f'🔄 Strona {current_page}...'
                    
                    # Sprawdź kolejne strony
                    if 'links' in result and 'next' in result['links'] and result['links']['next']:
                        current_page += 1
                    else:
                        break
                
                # Lokalne filtrowanie po roku produkcji (API nie wspiera)
                if year_from or year_to:
                    filtered_vehicles = []
                    for v in vehicles_data:
                        if 'attributes' in v and 'rok-produkcji' in v['attributes']:
                            try:
                                year = int(v['attributes']['rok-produkcji'])
                                if year_from and year < year_from:
                                    continue
                                if year_to and year > year_to:
                                    continue
                                filtered_vehicles.append(v)
                            except (ValueError, TypeError):
                                continue
                    vehicles_data = filtered_vehicles
                
                elapsed = time.time() - start_time
                with rate_limit_lock:
                    statuses[code]['status'] = '✅ Ukończono'
                    statuses[code]['count'] = len(vehicles_data)  # Zaktualizuj po filtrowaniu
                    statuses[code]['time'] = elapsed
                
                return (code, vehicles_data, None)
                
            except requests.exceptions.Timeout:
                elapsed = time.time() - start_time
                error_msg = f"Timeout (30s)"
                with rate_limit_lock:
                    statuses[code]['status'] = '❌ Błąd'
                    statuses[code]['error'] = error_msg
                    statuses[code]['time'] = elapsed
                return (code, [], error_msg)
                
            except requests.exceptions.RequestException as e:
                elapsed = time.time() - start_time
                error_msg = f"Błąd połączenia: {str(e)[:50]}"
                with rate_limit_lock:
                    statuses[code]['status'] = '❌ Błąd'
                    statuses[code]['error'] = error_msg
                    statuses[code]['time'] = elapsed
                return (code, [], error_msg)
                
            except Exception as e:
                elapsed = time.time() - start_time
                error_msg = f"Błąd: {str(e)[:50]}"
                with rate_limit_lock:
                    statuses[code]['status'] = '❌ Błąd'
                    statuses[code]['error'] = error_msg
                    statuses[code]['time'] = elapsed
                return (code, [], error_msg)
        
        # Inicjalizuj statusy dla wszystkich województw PRZED rozpoczęciem
        for code in voiv_codes:
            voiv_name = self.WOJEWODZTWA_KODY.get(code, code)
            statuses[code] = {
                'name': voiv_name,
                'status': '⏳ Oczekiwanie...',
                'count': 0,
                'pages': 0,
                'error': None,
                'time': 0,
                'start_time': time.time()
            }
        
        # Pierwsze wywołanie callback z początkowym stanem
        if progress_callback:
            progress_callback(statuses.copy())
        
        # Wykonaj równolegle (max 2 jednocześnie - zmniejszone dla stabilności API)
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {executor.submit(fetch_voivodeship, code): code for code in voiv_codes}
            
            # Użyj as_completed() BEZ timeout dla lepszej wydajności
            completed_count = 0
            total_count = len(futures)
            last_ui_update = time.time()
            UI_UPDATE_INTERVAL = 2.0  # aktualizuj UI co 2s (jeśli nic się nie zakończyło)
            
            for future in as_completed(futures):
                code, vehicles, error = future.result()
                
                if error:
                    errors.append(f"{self.WOJEWODZTWA_KODY.get(code, code)}: {error}")
                
                if vehicles:
                    # Deduplicacja między województwami
                    for vehicle in vehicles:
                        vehicle_id = vehicle.get('id')
                        if vehicle_id and vehicle_id not in seen_ids:
                            seen_ids.add(vehicle_id)
                            all_vehicles.append(vehicle)
                
                completed_count += 1
                
                # Aktualizuj UI po każdym zakończonym województwie
                # (wywołane z głównego wątku, nie z osobnego wątku)
                if progress_callback:
                    with rate_limit_lock:
                        progress_callback(statuses.copy())
                    last_ui_update = time.time()
        
        return all_vehicles, errors, statuses
