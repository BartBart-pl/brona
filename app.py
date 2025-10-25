"""
BRONA - Bieżące Raporty O Nabytych Autach
Aplikacja Streamlit do przeglądania danych z CEPiK
Wersja 2.3
"""
import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime, timedelta
from cepik_api import CepikAPI


# Konfiguracja strony
st.set_page_config(
    page_title="BRONA - Bieżące Raporty O Nabytych Autach",
    page_icon="🚗",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Inicjalizacja API
@st.cache_resource
def init_api():
    return CepikAPI()

api = init_api()

# Tytuł aplikacji
st.title("🚗 BRONA - Bieżące Raporty O Nabytych Autach")
st.markdown("Wyszukiwarka i analiza danych o pojazdach zarejestrowanych w Polsce (baza CEPiK)")

# Informacja o działaniu API
with st.expander("ℹ️ Jak działa aplikacja?"):
    st.markdown("""
    **API CEPiK pozwala wyszukiwać pojazdy według:**
    - ✅ Województwa (wymagane)
    - ✅ Zakresu dat pierwszej rejestracji (wymagane)
    - ✅ Marki pojazdu (opcjonalne - filtrowanie przez API)
    - ✅ Modelu pojazdu (opcjonalne - filtrowanie przez API)
    
    **Po pobraniu danych możesz dodatkowo filtrować:**
    - 🔍 Po roku produkcji (lokalne filtrowanie)
    - 🔍 Po rodzaju paliwa (w tabeli)
    
    **Wskazówki:**
    - ⚡ Użyj filtrów marki/modelu przed wyszukiwaniem - API zwróci tylko pasujące pojazdy (szybciej!)
    - 📊 Bez filtrów pobierzesz wszystkie pojazdy z okresu (może być ich dużo)
    - ⏱️ Pobieranie dużej ilości pojazdów może potrwać do 60 sekund
    """)

# Sidebar z filtrami
st.sidebar.header("🔍 Wyszukiwanie")

# Pobieranie województw
with st.spinner("Ładowanie województw..."):
    voivodeships = api.get_voivodeships()

# 1. WOJEWÓDZTWO (wymagane)
st.sidebar.markdown("### 📍 Województwo *")

# Posortuj województwa alfabetycznie według nazwy
voivodeships_sorted = sorted(voivodeships, key=lambda x: x[1])

# Stwórz mapowanie nazwa -> kod dla łatwego odczytu
voiv_name_to_code = {nazwa: kod for kod, nazwa in voivodeships_sorted}

# Lista opcji - tylko nazwy, alfabetycznie
voiv_options = ["WSZYSTKIE"] + [nazwa for kod, nazwa in voivodeships_sorted]

selected_voiv = st.sidebar.selectbox(
    "Wybierz województwo",
    options=voiv_options,
    index=0,  # Domyślnie "WSZYSTKIE"
    help="Wybierz województwo lub WSZYSTKIE"
)

# Wyciągnij kod województwa lub ustaw flagę dla wszystkich
if selected_voiv == "WSZYSTKIE":
    voiv_code = "ALL"
    voiv_codes_list = [kod for kod, nazwa in voivodeships]
else:
    voiv_code = voiv_name_to_code.get(selected_voiv)
    voiv_codes_list = None

# 2. ZAKRES DAT (wymagany)
st.sidebar.markdown("### 📅 Zakres dat pierwszej rejestracji *")

# Inicjalizacja domyślnych dat w session state
if 'date_from' not in st.session_state:
    st.session_state.date_from = (datetime.now().replace(day=1) - timedelta(days=1)).replace(day=1)
if 'date_to' not in st.session_state:
    st.session_state.date_to = datetime.now().replace(day=1) - timedelta(days=1)

# Przyciski szybkiego wyboru
col_btn1, col_btn2, col_btn3 = st.sidebar.columns(3)
with col_btn1:
    if st.button("📅 Poprzedni rok", use_container_width=True):
        last_year = datetime.now().year - 1
        st.session_state.date_from = datetime(last_year, 1, 1)
        st.session_state.date_to = datetime(last_year, 12, 31)
        st.rerun()

with col_btn2:
    if st.button("📆 Aktualny rok", use_container_width=True):
        st.session_state.date_from = datetime(datetime.now().year, 1, 1)
        st.session_state.date_to = datetime.now()
        st.rerun()

with col_btn3:
    if st.button("📋 Aktualny miesiąc", use_container_width=True):
        st.session_state.date_from = datetime.now().replace(day=1)
        st.session_state.date_to = datetime.now()
        st.rerun()

col_date1, col_date2 = st.sidebar.columns(2)
with col_date1:
    date_from = st.date_input(
        "Data od",
        value=st.session_state.date_from,
        max_value=datetime.now(),
        help="Data pierwszej rejestracji od",
        key="date_from_input"
    )

with col_date2:
    date_to = st.date_input(
        "Data do",
        value=st.session_state.date_to,
        max_value=datetime.now(),
        help="Data pierwszej rejestracji do",
        key="date_to_input"
    )

# Aktualizuj session state gdy użytkownik zmieni ręcznie
st.session_state.date_from = date_from
st.session_state.date_to = date_to

# 3. FILTRY API (wszystkie w jednej ramce)
st.sidebar.markdown("### 🚀 Filtry wyszukiwania")
st.sidebar.caption("⚡ Filtrowanie przez API - zwraca tylko pasujące pojazdy")

# Pobierz słowniki z API
with st.spinner("Ładowanie słowników..."):
    dictionaries = api.get_all_dictionaries()

with st.sidebar.expander("🔧 Wszystkie filtry", expanded=True):
    # Marka - z API (dropdown jeśli dostępne)
    marki = dictionaries.get('marka', [])
    if marki and len(marki) > 0:
        brand_options = ["Wpisz markę...", "-- Wszystkie --"] + sorted(marki)
        brand_search = st.selectbox(
            "Marka pojazdu",
            options=brand_options,
            index=0,
            key="brand_filter"
        )
        if brand_search in ["Wpisz markę...", "-- Wszystkie --"]:
            brand_search = None
    else:
        brand_search = st.text_input(
            "Marka pojazdu",
            value="",
            placeholder="np. BMW, TOYOTA, AUDI",
            key="brand_filter"
        )
        brand_search = brand_search if brand_search else None
    
    # Model - text input (za dużo wartości dla dropdown)
    model_search = st.text_input(
        "Model pojazdu",
        value="",
        placeholder="np. X5, COROLLA, A4",
        help="Wielkość liter nie ma znaczenia. Zostaw puste dla wszystkich modeli.",
        key="model_filter"
    )
    model_search = model_search if model_search else None
    
    # Rok produkcji
    st.markdown("**Rok produkcji:**")
    col_year1, col_year2 = st.columns(2)
    with col_year1:
        year_from = st.number_input(
            "Od roku",
            min_value=1900,
            max_value=datetime.now().year,
            value=2020,
            step=1,
            help="Rok produkcji od",
            key="year_from_filter"
        )
    with col_year2:
        year_to = st.number_input(
            "Do roku",
            min_value=1900,
            max_value=datetime.now().year,
            value=datetime.now().year,
            step=1,
            help="Rok produkcji do",
            key="year_to_filter"
        )
    
    st.markdown("---")
    st.markdown("**Dodatkowe filtry API:**")
    
    api_filters = {}
    
    # Mapowanie nazw słowników na przyjazne etykiety
    dict_labels = {
        'rodzaj-pojazdu': 'Rodzaj pojazdu',
        'rodzaj-paliwa': 'Rodzaj paliwa',
        'pochodzenie-pojazdu': 'Pochodzenie pojazdu',
        'sposob-produkcji': 'Sposób produkcji'
    }
    
    # Dynamiczne tworzenie dropdownów dla wszystkich dostępnych słowników
    # (oprócz marki, która jest obsłużona wyżej, i województw)
    excluded_dicts = {'marka', 'wojewodztwa'}
    
    for dict_id, dict_values in dictionaries.items():
        if dict_id in excluded_dicts or not dict_values:
            continue
        
        # Określ etykietę dla dropdown
        label = dict_labels.get(dict_id, dict_id.replace('-', ' ').title())
        
        # Utwórz dropdown z wartościami ze słownika
        options = ["-- Wszystkie --"] + dict_values
        selected_value = st.selectbox(
            label,
            options=options,
            index=0,
            key=f"api_{dict_id}_filter"
        )
        
        # Jeśli wybrano wartość, dodaj do filtrów API
        if selected_value != "-- Wszystkie --":
            api_filters[dict_id] = selected_value

# Backward compatibility - już nie używane ale zostawmy dla bezpieczeństwa
api_brand = None
api_model = None

# Opcja dodawania do istniejących danych
st.sidebar.markdown("---")
append_mode = st.sidebar.checkbox(
    "➕ Dodaj do istniejących danych",
    value=False,
    help="Zaznacz aby dodać nowe wyniki do poprzednich zamiast je zastępować"
)

# Przycisk wyszukiwania
search_button = st.sidebar.button("🔎 Wyszukaj pojazdy", type="primary", use_container_width=True)

# Przycisk czyszczenia danych
if st.session_state.get('vehicles_data'):
    if st.sidebar.button("🗑️ Wyczyść dane", use_container_width=True):
        st.session_state.vehicles_data = None
        st.session_state.search_params = None
        st.rerun()

st.sidebar.markdown("---")
st.sidebar.markdown(r"**\* Pola wymagane**")

# Stan aplikacji (przechowywanie danych między odświeżeniami)
if 'vehicles_data' not in st.session_state:
    st.session_state.vehicles_data = None
if 'search_params' not in st.session_state:
    st.session_state.search_params = None
if 'batch_id_counter' not in st.session_state:
    st.session_state.batch_id_counter = 0

# WYSZUKIWANIE
if search_button:
    # Walidacja
    if not voiv_code:
        st.error("⚠️ Wybierz województwo!")
    elif not date_from or not date_to:
        st.error("⚠️ Wybierz zakres dat!")
    elif date_from > date_to:
        st.error("⚠️ Data 'od' nie może być późniejsza niż data 'do'!")
    else:
        # Konwersja dat na format API (YYYYMMDD)
        date_from_str = date_from.strftime("%Y%m%d")
        date_to_str = date_to.strftime("%Y%m%d")
        
        # Jeśli wybrano WSZYSTKIE województwa
        if voiv_code == "ALL":
            st.info(f"⏳ Odpytywanie {len(voiv_codes_list)} województw równolegle (max 5 jednocześnie)...")
            
            # Twórz placeholder dla tabeli statusów
            status_placeholder = st.empty()
            
            def progress_callback(statuses_dict):
                """Wyświetl szczegółową tabelę statusów dla każdego województwa"""
                # Przygotuj dane do tabeli
                status_data = []
                completed_count = 0
                rate_limited = False
                
                for code in sorted(statuses_dict.keys()):
                    s = statuses_dict[code]
                    status_data.append({
                        'Województwo': s['name'],
                        'Status': s['status'],
                        'Pojazdów': s['count'],
                        'Stron': s['pages'],
                        'Czas [s]': f"{s['time']:.1f}" if s['time'] > 0 else "-"
                    })
                    
                    if s['status'] == '✅ Ukończono':
                        completed_count += 1
                    elif '⏸️' in s['status'] or 'Rate limit' in s['status']:
                        rate_limited = True
                
                # Wyświetl tabelę
                with status_placeholder.container():
                    # Progress bar
                    progress = completed_count / len(statuses_dict) if statuses_dict else 0
                    st.progress(progress)
                    st.caption(f"Ukończono: {completed_count}/{len(statuses_dict)} województw")
                    
                    # Komunikat o rate limiting
                    if rate_limited:
                        st.warning("⚠️ **PRZEKROCZONO LIMIT ZAPYTAŃ** - Wstrzymano wszystkie zapytania na 30 sekund...")
                    
                    # Tabela statusów
                    df_status = pd.DataFrame(status_data)
                    st.dataframe(
                        df_status,
                        use_container_width=True,
                        hide_index=True,
                        height=400
                    )
            
            # Przygotuj dodatkowe filtry (bez marka/model, bo są osobne parametry)
            add_filters = {k: v for k, v in api_filters.items() if k not in ['marka', 'model']}
            
            # Użyj równoległego pobierania
            all_vehicles, errors, statuses = api.search_all_voivodeships_parallel(
                date_from=date_from_str,
                date_to=date_to_str,
                brand=api_brand or brand_search if (api_brand or brand_search) else None,
                model=api_model or model_search if (api_model or model_search) else None,
                year_from=year_from,
                year_to=year_to,
                progress_callback=progress_callback,
                additional_filters=add_filters
            )
            
            status_placeholder.empty()
            
            # Końcowe podsumowanie ze statystykami
            st.markdown("### 📊 Podsumowanie pobierania")
            
            # Oblicz statystyki
            completed = sum(1 for s in statuses.values() if s['status'] == '✅ Ukończono')
            failed = sum(1 for s in statuses.values() if s['status'] == '❌ Błąd')
            total_time = max([s['time'] for s in statuses.values()], default=0)
            avg_time = sum([s['time'] for s in statuses.values()]) / len(statuses) if statuses else 0
            total_fetched = sum([s['count'] for s in statuses.values()])
            
            # Metryki
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                st.metric("Ukończono", f"{completed}/{len(statuses)}", 
                         delta=f"{(completed/len(statuses)*100):.0f}%" if statuses else "0%")
            with col2:
                st.metric("Pojazdów", total_fetched, delta="deduplikowanych" if len(all_vehicles) < total_fetched else "")
            with col3:
                st.metric("Całkowity czas", f"{total_time:.1f}s")
            with col4:
                st.metric("Średni czas/woj", f"{avg_time:.1f}s")
            
            # Szczegółowe statystyki w expander
            with st.expander("📋 Szczegółowe statystyki województw"):
                status_data = []
                for code in sorted(statuses.keys()):
                    s = statuses[code]
                    status_data.append({
                        'Województwo': s['name'],
                        'Status': s['status'],
                        'Pojazdów': s['count'],
                        'Stron': s['pages'],
                        'Czas [s]': f"{s['time']:.1f}",
                        'Błąd': s['error'] if s['error'] else '-'
                    })
                
                df_final = pd.DataFrame(status_data)
                st.dataframe(df_final, use_container_width=True, hide_index=True)
            
            # Ostrzeżenia/błędy
            if errors:
                with st.expander("⚠️ Błędy podczas pobierania", expanded=failed > 0):
                    for error in errors:
                        st.error(error)
            
            if all_vehicles:
                # Przypisz batch_id dla śledzenia źródła danych (dla wykresów z różnymi kolorami)
                st.session_state.batch_id_counter += 1
                current_batch_id = st.session_state.batch_id_counter
                
                # Dodaj batch_id do każdego pojazdu
                for vehicle in all_vehicles:
                    vehicle['_batch_id'] = current_batch_id
                
                results = {
                    'data': all_vehicles,
                    'meta': {'total': len(all_vehicles)}
                }
                
                # Append mode - dodaj do istniejących
                if append_mode and st.session_state.vehicles_data:
                    existing_data = st.session_state.vehicles_data['data']
                    combined_data = existing_data + all_vehicles
                    results = {
                        'data': combined_data,
                        'meta': {'total': len(combined_data)}
                    }
                    msg = f"➕ Dodano {len(all_vehicles)} nowych pojazdów (Batch #{current_batch_id}). Łącznie: {len(combined_data)} pojazdów"
                else:
                    msg = f"✅ Znaleziono {len(all_vehicles)} pojazdów ze wszystkich województw (Batch #{current_batch_id})"
                
                st.session_state.vehicles_data = results
                st.session_state.search_params = {
                    'voiv': 'WSZYSTKIE WOJEWÓDZTWA',
                    'date_from': date_from,
                    'date_to': date_to,
                    'brand': brand_search,
                    'model': model_search
                }
                
                if brand_search:
                    msg += f" marki {brand_search}"
                if model_search:
                    msg += f" model {model_search}"
                st.success(msg + "!")
            else:
                st.error("❌ Nie znaleziono żadnych pojazdów we wszystkich województwach")
        
        else:
            # Pojedyncze województwo z progress bar
            search_msg = f"Wyszukiwanie w {selected_voiv.split(' - ')[1]}"
            if brand_search:
                search_msg += f" | Marka: {brand_search}"
            if model_search:
                search_msg += f" | Model: {model_search}"
            
            st.info(f"⏳ {search_msg}...")
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            def progress_callback(page, total, fetched):
                if total > 0:
                    progress = min(fetched / total, 1.0)
                    status_text.text(f"Pobrano: {fetched}/{total} pojazdów (strona {page})")
                    progress_bar.progress(progress)
            
            # Użyj API filters jeśli są włączone, w przeciwnym razie użyj brand_search/model_search
            final_brand = api_brand if api_brand else (brand_search if brand_search else None)
            final_model = api_model if api_model else (model_search if model_search else None)
            
            # Przygotuj dodatkowe filtry (bez marka/model, bo są osobne parametry)
            add_filters = {k: v for k, v in api_filters.items() if k not in ['marka', 'model']}
            
            results = api.search_vehicles(
                voivodeship_code=voiv_code,
                date_from=date_from_str,
                date_to=date_to_str,
                brand=final_brand,
                model=final_model,
                year_from=year_from,
                year_to=year_to,
                retry=True,
                additional_filters=add_filters,
                progress_callback=progress_callback
            )
            
            progress_bar.empty()
            status_text.empty()
            
            if 'error' in results:
                st.error(f"❌ {results['error']}")
            elif 'data' in results:
                # Przypisz batch_id dla śledzenia źródła danych
                st.session_state.batch_id_counter += 1
                current_batch_id = st.session_state.batch_id_counter
                
                # Dodaj batch_id do każdego pojazdu
                for vehicle in results['data']:
                    vehicle['_batch_id'] = current_batch_id
                
                # Append mode - dodaj do istniejących
                if append_mode and st.session_state.vehicles_data:
                    existing_data = st.session_state.vehicles_data['data']
                    combined_data = existing_data + results['data']
                    results = {
                        'data': combined_data,
                        'meta': results.get('meta', {})
                    }
                    msg = f"➕ Dodano {len(results['data'])} nowych pojazdów (Batch #{current_batch_id}). Łącznie: {len(combined_data)} pojazdów"
                else:
                    msg = f"✅ Znaleziono {len(results['data'])} pojazdów (Batch #{current_batch_id})"
                
                st.session_state.vehicles_data = results
                st.session_state.search_params = {
                    'voiv': selected_voiv,
                    'date_from': date_from,
                    'date_to': date_to,
                    'brand': brand_search,
                    'model': model_search
                }
                
                if brand_search:
                    msg += f" marki {brand_search}"
                if model_search:
                    msg += f" model {model_search}"
                st.success(msg + "!")

# WYŚWIETLANIE WYNIKÓW
if st.session_state.vehicles_data:
    data = st.session_state.vehicles_data
    params = st.session_state.search_params
    
    st.markdown("---")
    st.markdown("## 📊 Wyniki wyszukiwania")
    
    # Konwersja do DataFrame aby sprawdzić batche
    df_temp = api.vehicles_to_dataframe(data)
    
    # Sprawdź czy są różne batche
    if '_batch_id' in df_temp.columns and df_temp['_batch_id'].nunique() > 1:
        # Pokaż statystyki per batch
        st.markdown("### 📦 Podsumowanie wyszukiwań")
        
        batch_ids = sorted(df_temp['_batch_id'].unique())
        cols = st.columns(min(len(batch_ids), 4))
        
        for idx, batch_id in enumerate(batch_ids):
            with cols[idx % 4]:
                batch_data = df_temp[df_temp['_batch_id'] == batch_id]
                st.metric(
                    f"Zapytanie #{batch_id}",
                    f"{len(batch_data)} pojazdów",
                    delta=None
                )
        
        st.info(f"**Łącznie:** {len(df_temp)} pojazdów z {len(batch_ids)} zapytań")
    else:
        # Pojedyncze wyszukiwanie - stara wersja
        info_text = f"""
        **Województwo:** {params['voiv']}  
        **Okres:** {params['date_from'].strftime('%Y-%m-%d')} - {params['date_to'].strftime('%Y-%m-%d')}"""
        
        if params.get('brand'):
            info_text += f"  \n**Marka:** {params['brand']}"
        if params.get('model'):
            info_text += f"  \n**Model:** {params['model']}"
        
        info_text += f"  \n**Liczba pojazdów:** {len(data['data'])}"
        
        st.info(info_text)
    
    if len(data['data']) == 0:
        st.warning("Nie znaleziono pojazdów dla wybranych kryteriów.")
    else:
        # Konwersja do DataFrame
        df = api.vehicles_to_dataframe(data)
        
        if df.empty:
            st.warning("Nie można przetworzyć danych.")
        else:
            # FILTRY I SORTOWANIE - DYNAMICZNE
            st.markdown("### 🔍 Filtruj i sortuj wyniki")
            
            # Automatyczne wykrywanie typów kolumn
            # Wyklucz tylko _batch_id i id
            excluded_cols = {'id', '_batch_id'}
            
            categorical_cols = []
            numeric_cols = []
            date_cols = []
            all_cols = []
            
            for col in df.columns:
                if col in excluded_cols:
                    continue
                
                all_cols.append(col)
                    
                # Kolumny numeryczne
                if pd.api.types.is_numeric_dtype(df[col]):
                    numeric_cols.append(col)
                # Kolumny z datami
                elif 'data' in col.lower() or 'date' in col.lower():
                    date_cols.append(col)
                # Kolumny kategoryczne
                elif df[col].nunique() < 200:  # Zwiększony limit
                    categorical_cols.append(col)
                else:
                    # Pozostałe kolumny traktuj jako tekst
                    categorical_cols.append(col)
            
            # Expandable advanced filters
            with st.expander("🎛️ Filtry dynamiczne", expanded=False):
                # Wybór kolumn do filtrowania
                st.markdown("**Wybierz kolumny do filtrowania:**")
                available_options = all_cols  # Wszystkie kolumny dostępne
                cols_to_filter = st.multiselect(
                    "Kolumny",
                    options=available_options,
                    default=[c for c in ['rok-produkcji', 'rodzaj-pojazdu', 'rodzaj-paliwa'] if c in available_options][:3],
                    key="filter_cols_select"
                )
                
                if cols_to_filter:
                    st.markdown("---")
                    filter_col1, filter_col2 = st.columns(2)
                    
                    filters_applied = {}
                    col_idx = 0
                    
                    for col in cols_to_filter:
                        target_col = filter_col1 if col_idx % 2 == 0 else filter_col2
                        
                        with target_col:
                            if col in categorical_cols:
                                # Filtr kategoryczny
                                unique_vals = sorted(df[col].dropna().unique().tolist())
                                if len(unique_vals) > 0:
                                    selected = st.multiselect(
                                        f"📌 {col}",
                                        options=unique_vals,
                                        default=None,
                                        key=f"cat_filter_{col}"
                                    )
                                    if selected:
                                        filters_applied[col] = ('categorical', selected)
                            
                            elif col in numeric_cols:
                                # Filtr numeryczny (slider) - używamy integerów
                                vals = df[col].dropna()
                                if len(vals) > 0:
                                    try:
                                        min_val = int(vals.min())
                                        max_val = int(vals.max())
                                        if min_val != max_val:
                                            selected_range = st.slider(
                                                f"🔢 {col}",
                                                min_value=min_val,
                                                max_value=max_val,
                                                value=(min_val, max_val),
                                                step=1,
                                                key=f"num_filter_{col}"
                                            )
                                            if selected_range != (min_val, max_val):
                                                filters_applied[col] = ('numeric', selected_range)
                                    except:
                                        pass
                        
                        col_idx += 1
                    
                    # Przycisk reset filtrów
                    if st.button("🔄 Resetuj filtry", key="reset_filters_btn"):
                        st.rerun()
            
            # Sortowanie
            sort_col1, sort_col2, sort_col3 = st.columns([2, 2, 1])
            
            with sort_col1:
                sort_column = st.selectbox(
                    "Sortuj według",
                    options=['Brak sortowania'] + list(df.columns),
                    key="sort_col"
                )
            
            with sort_col2:
                if sort_column != 'Brak sortowania':
                    sort_order = st.radio(
                        "Kierunek",
                        options=['Rosnąco ⬆️', 'Malejąco ⬇️'],
                        horizontal=True,
                        key="sort_order"
                    )
                else:
                    sort_order = 'Rosnąco ⬆️'
            
            with sort_col3:
                st.metric("Rekordów", len(df))
            
            # Zastosuj filtry dynamicznie
            df_filtered = df.copy()
            
            if 'filters_applied' in locals():
                for col, (filter_type, filter_value) in filters_applied.items():
                    if filter_type == 'categorical':
                        df_filtered = df_filtered[df_filtered[col].isin(filter_value)]
                    elif filter_type == 'numeric':
                        df_filtered = df_filtered[
                            (df_filtered[col] >= filter_value[0]) &
                            (df_filtered[col] <= filter_value[1])
                        ]
            
            # Zastosuj sortowanie
            if sort_column != 'Brak sortowania':
                ascending = (sort_order == 'Rosnąco ⬆️')
                try:
                    df_filtered = df_filtered.sort_values(by=sort_column, ascending=ascending)
                except:
                    pass
            
            # Statystyki
            st.markdown("### 📈 Statystyki")
            col1, col2, col3, col4, col5 = st.columns(5)
            
            with col1:
                st.metric("Po filtrach", len(df_filtered), delta=f"{len(df_filtered)-len(df)}")
            with col2:
                st.metric("Wszystkich", len(df))
            with col3:
                st.metric("Unikalne marki", df_filtered['marka'].nunique())
            with col4:
                if 'rok-produkcji' in df_filtered.columns:
                    years_numeric = pd.to_numeric(df_filtered['rok-produkcji'], errors='coerce')
                    avg_year = int(years_numeric.mean()) if not years_numeric.isna().all() else 0
                    st.metric("Średni rok prod.", avg_year)
                else:
                    st.metric("Średni rok prod.", "N/A")
            with col5:
                filtered_pct = (len(df_filtered) / len(df) * 100) if len(df) > 0 else 0
                st.metric("% pokazanych", f"{filtered_pct:.1f}%")
            
            # Tabela z wyborem kolumn
            st.markdown("### 📋 Lista pojazdów")
            
            # Wszystkie dostępne kolumny
            all_available_columns = list(df_filtered.columns)
            
            # Domyślne kolumny do wyświetlenia
            default_columns = ['marka', 'model', 'rok-produkcji', 'rodzaj-pojazdu', 
                             'rodzaj-paliwa', 'pojemnosc-skokowa-silnika', 'masa-wlasna']
            default_display = [col for col in default_columns if col in all_available_columns]
            
            # Multiselect do wyboru kolumn
            st.markdown("**Wybór kolumn:**")
            col_select1, col_select2 = st.columns([3, 1])
            
            with col_select1:
                selected_columns = st.multiselect(
                    "Kolumny do wyświetlenia:",
                    options=all_available_columns,
                    default=default_display,
                    help="Zaznacz kolumny, które chcesz zobaczyć w tabeli",
                    label_visibility="collapsed"
                )
            
            with col_select2:
                # Przycisk do zaznaczenia wszystkich
                show_all = st.checkbox("Wszystkie", value=False)
                if show_all:
                    selected_columns = all_available_columns
            
            if not selected_columns:
                st.warning("⚠️ Wybierz przynajmniej jedną kolumnę do wyświetlenia")
            else:
                # Info o sortowaniu w tabeli
                st.info("💡 Kliknij nagłówek kolumny w tabeli aby posortować. Pierwsze kliknięcie - sortowanie rosnąco, drugie kliknięcie - sortowanie malejąco.")
                
                # Tabela z możliwością sortowania
                st.dataframe(
                    df_filtered[selected_columns],
                    use_container_width=True,
                    height=400,
                    hide_index=False
                )
            
            # Wizualizacje z dynamicznym wyborem kolumn
            if len(df_filtered) > 0:
                st.markdown("### 📊 Wizualizacje")
                
                # Wybór typu wykresu i kolumn
                viz_col1, viz_col2, viz_col3 = st.columns([2, 2, 2])
                
                with viz_col1:
                    chart_type = st.selectbox(
                        "Typ wykresu",
                        ["Słupkowy (Bar)", "Kołowy (Pie)", "Histogram", "Scatter", "Box Plot"],
                        help="Wybierz typ wizualizacji"
                    )
                
                # Kolumny kategoryczne i numeryczne
                categorical_cols = [col for col in df_filtered.columns 
                                  if df_filtered[col].dtype == 'object' or df_filtered[col].nunique() < 50]
                numeric_cols = [col for col in df_filtered.columns 
                              if pd.api.types.is_numeric_dtype(df_filtered[col])]
                
                with viz_col2:
                    if chart_type in ["Słupkowy (Bar)", "Kołowy (Pie)"]:
                        x_column = st.selectbox(
                            "Kolumna do analizy",
                            categorical_cols,
                            index=categorical_cols.index('marka') if 'marka' in categorical_cols else 0,
                            help="Wybierz kolumnę kategoryczną"
                        )
                    elif chart_type == "Histogram":
                        x_column = st.selectbox(
                            "Kolumna do analizy",
                            numeric_cols,
                            index=numeric_cols.index('rok-produkcji') if 'rok-produkcji' in numeric_cols else 0,
                            help="Wybierz kolumnę numeryczną"
                        )
                    elif chart_type == "Scatter":
                        x_column = st.selectbox(
                            "Oś X",
                            numeric_cols,
                            help="Wybierz kolumnę dla osi X"
                        )
                    else:  # Box Plot
                        x_column = st.selectbox(
                            "Kategoria (X)",
                            categorical_cols,
                            help="Wybierz kolumnę kategoryczną"
                        )
                
                with viz_col3:
                    if chart_type == "Słupkowy (Bar)":
                        top_n = st.slider("Pokaż top", 5, 50, 15, help="Ile pozycji pokazać")
                    elif chart_type == "Scatter":
                        y_column = st.selectbox(
                            "Oś Y",
                            numeric_cols,
                            index=1 if len(numeric_cols) > 1 else 0,
                            help="Wybierz kolumnę dla osi Y"
                        )
                    elif chart_type == "Box Plot":
                        y_column = st.selectbox(
                            "Wartość (Y)",
                            numeric_cols,
                            help="Wybierz kolumnę numeryczną"
                        )
                
                # Sprawdź czy są różne batche (dla różnych kolorów)
                has_batch = '_batch_id' in df_filtered.columns and df_filtered['_batch_id'].nunique() > 1
                color_col = '_batch_id' if has_batch else None
                
                if has_batch:
                    # Konwertuj _batch_id na string dla lepszych legend
                    df_filtered['_batch_id'] = df_filtered['_batch_id'].astype(str)
                    df_filtered['_batch_id'] = 'Zapytanie #' + df_filtered['_batch_id']
                
                # Generowanie wykresu
                try:
                    if chart_type == "Słupkowy (Bar)":
                        if has_batch:
                            # Grupuj po x_column i _batch_id
                            df_grouped = df_filtered.groupby([x_column, '_batch_id']).size().reset_index(name='count')
                            df_grouped = df_grouped.sort_values('count', ascending=True)
                            fig = px.bar(
                                df_grouped.tail(top_n * 2),  # Więcej dla wielu batchy
                                y=x_column,
                                x='count',
                                color='_batch_id',
                                orientation='h',
                                labels={'count': 'Liczba', x_column: x_column},
                                title=f"Top {top_n}: {x_column} (kolorowane według źródła)"
                            )
                        else:
                            value_counts = df_filtered[x_column].value_counts().head(top_n)
                            fig = px.bar(
                                x=value_counts.values,
                                y=value_counts.index,
                                orientation='h',
                                labels={'x': 'Liczba', 'y': x_column},
                                title=f"Top {top_n}: {x_column}"
                            )
                        st.plotly_chart(fig, use_container_width=True)
                    
                    elif chart_type == "Kołowy (Pie)":
                        value_counts = df_filtered[x_column].value_counts().head(10)
                        fig = px.pie(
                            values=value_counts.values,
                            names=value_counts.index,
                            title=f"Rozkład: {x_column}"
                        )
                        st.plotly_chart(fig, use_container_width=True)
                    
                    elif chart_type == "Histogram":
                        df_clean = df_filtered[df_filtered[x_column].notna()].copy()
                        fig = px.histogram(
                            df_clean,
                            x=x_column,
                            color=color_col,
                            labels={x_column: x_column},
                            title=f"Histogram: {x_column}" + (" (kolorowane według źródła)" if has_batch else ""),
                            barmode='overlay' if has_batch else 'relative'
                        )
                        if has_batch:
                            fig.update_traces(opacity=0.6)
                        st.plotly_chart(fig, use_container_width=True)
                    
                    elif chart_type == "Scatter":
                        cols_needed = [x_column, y_column]
                        if has_batch:
                            cols_needed.append('_batch_id')
                        df_clean = df_filtered[cols_needed].dropna()
                        fig = px.scatter(
                            df_clean,
                            x=x_column,
                            y=y_column,
                            color=color_col,
                            title=f"Scatter: {x_column} vs {y_column}" + (" (kolorowane według źródła)" if has_batch else ""),
                            opacity=0.6
                        )
                        st.plotly_chart(fig, use_container_width=True)
                    
                    elif chart_type == "Box Plot":
                        cols_needed = [x_column, y_column]
                        if has_batch:
                            cols_needed.append('_batch_id')
                        df_clean = df_filtered[cols_needed].dropna()
                        fig = px.box(
                            df_clean,
                            x=x_column,
                            y=y_column,
                            color=color_col,
                            title=f"Box Plot: {y_column} według {x_column}" + (" (kolorowane według źródła)" if has_batch else "")
                        )
                        st.plotly_chart(fig, use_container_width=True)
                
                except Exception as e:
                    st.error(f"Błąd generowania wykresu: {str(e)}")
                    st.info("Spróbuj wybrać inne kolumny lub typ wykresu")
            
            # Eksport
            st.markdown("### 💾 Eksport danych")
            csv = df_filtered.to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 Pobierz wyniki jako CSV",
                data=csv,
                file_name=f"cepik_{params['voiv'].split()[0]}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
                mime="text/csv"
            )

else:
    # Ekran powitalny
    st.markdown("""
    ## Witaj w aplikacji BRONA! 👋
    
    ### Jak korzystać:
    
    1. **Wybierz województwo** w panelu po lewej (domyślnie: wszystkie)
    2. **Wybierz zakres dat** pierwszej rejestracji (użyj przycisków skrótu)
    3. **Ustaw filtry** - marka, model, rok produkcji, rodzaj pojazdu
    4. **Kliknij "🔍 Wyszukaj pojazdy"** aby pobrać dane z API CEPiK
    5. **Analizuj wyniki** - filtruj, sortuj, generuj wykresy
    6. **Eksportuj** dane do pliku CSV
    
    ### Ważne informacje:
    
    - ⏱️ Pobieranie danych dla wszystkich województw może potrwać kilka minut
    - 📊 Aplikacja automatycznie pobiera wszystkie strony wyników (bez limitu)
    - 🔍 Możesz łączyć wyniki z wielu zapytań
    - 💾 Pobrane dane pozostają w sesji
    - 📈 Wykresy automatycznie pokazują dane z różnych zapytań osobnymi kolorami
    
    ### Źródło danych:
    
    [API CEPiK](https://api.cepik.gov.pl/) - Centralna Ewidencja Pojazdów i Kierowców
    """)

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center'>
        <p><strong>BRONA - Bieżące Raporty O Nabytych Autach</strong></p>
        <p>Dane pochodzą z Centralnej Ewidencji Pojazdów i Kierowców (CEPiK)</p>
        <p>Aplikacja stworzona z wykorzystaniem Streamlit | © 2025 | v2.3</p>
    </div>
    """,
    unsafe_allow_html=True
)
