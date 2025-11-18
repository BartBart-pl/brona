/**
 * BRONA - Bieżące Raporty O Nabytych Autach
 * Client-side JavaScript application
 *
 * ARCHITEKTURA: 100% komunikacja po stronie klienta
 * - Wszystkie requesty wykonywane bezpośrednio z przeglądarki
 * - Używa Cloudflare Worker jako CORS proxy
 * - Brak backendu - czysta aplikacja statyczna
 */

// Konfiguracja
const CONFIG = {
    // WAŻNE: Po wdrożeniu Cloudflare Worker, zmień poniższy URL na swój:
    // API_URL: 'https://your-worker-name.your-subdomain.workers.dev',

    // Dla developmentu lokalnego (z proxy_server.py):
    API_URL: '/api',
    // API_URL: 'https://wispy-sunset-6278.bartlomiej-bartczak.workers.dev',

    // Dla produkcji (Cloudflare Worker - WKLEJ SWÓJ URL):
    // API_URL: 'https://brona-proxy.workers.dev',

    MAX_CONCURRENT_REQUESTS: 5,
    TIMEOUT: 30000,
    RETRY_DELAY: 1000,
    RATE_LIMIT_DELAY: 30000
};

// Mapa województw
const VOIVODESHIPS = {
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
};

// Stan aplikacji
let appState = {
    allVehicles: [],
    filteredVehicles: [],
    dictionaries: {},
    currentPage: 1,
    pageSize: 100,
    sortColumn: null,
    sortDirection: 'asc',
    searchParams: null,
    batchCounter: 0,
    voivodeshipStatuses: {},  // Status pobierania z województw
    dynamicFilters: {},       // Dynamiczne filtry
    selectedColumns: [],      // Wybrane kolumny do wyświetlenia
    availableColumns: []      // Dostępne kolumny
};

// Inicjalizacja aplikacji
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicjalizacja aplikacji BRONA...');
    
    // Załaduj województwa
    loadVoivodeships();
    
    // Załaduj słowniki
    await loadDictionaries();
    
    // Ustaw domyślne daty
    setDefaultDates();
    
    // Event listenery
    setupEventListeners();
    
    console.log('Aplikacja gotowa!');
});

// Ładowanie województw do selecta
function loadVoivodeships() {
    const select = document.getElementById('voivodeshipSelect');
    Object.entries(VOIVODESHIPS).forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${code} - ${name}`;
        select.appendChild(option);
    });
}

// Ładowanie słowników z API
async function loadDictionaries() {
    console.log('Ładowanie słowników z API...');

    try {
        // Pobierz listę słowników
        const url = `${CONFIG.API_URL}/slowniki?limit=100&page=1`;
        console.log('Fetching:', url);

        const response = await fetch(url);
        console.log('Response status:', response.status, response.statusText);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Słowniki response:', data);

        if (data.data && Array.isArray(data.data)) {
            // Pobierz wartości dla interesujących nas słowników
            const dictionariesToLoad = ['marka', 'rodzaj-pojazdu', 'rodzaj-paliwa'];

            for (const dictItem of data.data) {
                const dictId = dictItem.id;
                if (dictionariesToLoad.includes(dictId)) {
                    console.log(`Ładowanie słownika: ${dictId}...`);
                    const values = await loadDictionary(dictId);
                    if (values.length > 0) {
                        appState.dictionaries[dictId] = values;
                        populateFilterSelect(dictId, values);
                        console.log(`✓ Załadowano ${dictId}: ${values.length} wartości`);
                    }
                }
            }
        }

        console.log('✓ Wszystkie słowniki załadowane:', appState.dictionaries);
    } catch (error) {
        console.error('❌ Błąd ładowania słowników:', error);
        console.error('Details:', error.message);
        // Aplikacja będzie działać bez słowników - używając wartości z danych
    }
}

// Ładowanie pojedynczego słownika
async function loadDictionary(dictionaryName) {
    try {
        const url = `${CONFIG.API_URL}/slowniki/${dictionaryName}`;
        console.log(`  Fetching dictionary: ${url}`);

        const response = await fetch(url);
        console.log(`  Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.data && data.data.attributes && data.data.attributes['dostepne-rekordy-slownika']) {
            const records = data.data.attributes['dostepne-rekordy-slownika'];
            const values = records
                .map(r => r['klucz-slownika'])
                .filter(v => v && !v.match(/^\d+$/)); // Usuń wartości czysto liczbowe
            console.log(`  ✓ Parsed ${values.length} values for ${dictionaryName}`);
            return values;
        }
        console.warn(`  ⚠️ No records found for ${dictionaryName}`);
        return [];
    } catch (error) {
        console.error(`  ❌ Błąd ładowania słownika ${dictionaryName}:`, error);
        console.error(`  Details:`, error.message);
        return [];
    }
}

// Wypełnianie selectów filtrów
function populateFilterSelect(dictId, values) {
    let selectId;
    if (dictId === 'marka') selectId = 'brandFilter';
    else if (dictId === 'rodzaj-pojazdu') selectId = 'vehicleTypeFilter';
    else if (dictId === 'rodzaj-paliwa') selectId = 'fuelTypeFilter';
    else return;
    
    const select = document.getElementById(selectId);
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

// Ustawienie domyślnych dat
function setDefaultDates() {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Domyślnie: poprzedni miesiąc
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    document.getElementById('dateFrom').value = formatDateInput(firstDayPrevMonth);
    document.getElementById('dateTo').value = formatDateInput(lastDayPrevMonth);
    
    // Ustaw rok produkcji
    document.getElementById('yearTo').value = currentYear;
}

// Format daty dla input type="date"
function formatDateInput(date) {
    return date.toISOString().split('T')[0];
}

// Format daty dla API (YYYYMMDD)
function formatDateAPI(dateString) {
    return dateString.replace(/-/g, '');
}

// Setup event listeners
function setupEventListeners() {
    // Przyciski dat
    document.getElementById('btnPrevYear').addEventListener('click', () => {
        const now = new Date();
        const lastYear = now.getFullYear() - 1;
        document.getElementById('dateFrom').value = `${lastYear}-01-01`;
        document.getElementById('dateTo').value = `${lastYear}-12-31`;
    });

    document.getElementById('btnCurrentYear').addEventListener('click', () => {
        const now = new Date();
        const year = now.getFullYear();
        document.getElementById('dateFrom').value = `${year}-01-01`;
        document.getElementById('dateTo').value = formatDateInput(now);
    });

    document.getElementById('btnCurrentMonth').addEventListener('click', () => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        document.getElementById('dateFrom').value = formatDateInput(firstDay);
        document.getElementById('dateTo').value = formatDateInput(now);
    });

    // Przycisk wyszukiwania
    document.getElementById('searchBtn').addEventListener('click', handleSearch);

    // Przycisk czyszczenia
    document.getElementById('clearBtn').addEventListener('click', () => {
        appState.allVehicles = [];
        appState.filteredVehicles = [];
        appState.batchCounter = 0;
        showScreen('welcome');
        document.getElementById('clearBtn').style.display = 'none';
    });

    // Filtry wyników
    document.getElementById('filterBrand').addEventListener('change', applyFilters);
    document.getElementById('filterVehicleType').addEventListener('change', applyFilters);
    document.getElementById('filterFuelType').addEventListener('change', applyFilters);
    document.getElementById('filterYearRange').addEventListener('input', (e) => {
        document.getElementById('filterYearMax').textContent = e.target.value;
        applyFilters();
    });
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

    // Dynamiczne filtry
    document.getElementById('columnsToFilter').addEventListener('change', updateDynamicFilters);

    // Wybór kolumn do wyświetlenia
    document.getElementById('columnsToDisplay').addEventListener('change', () => {
        updateSelectedColumns();
        renderTable();
    });
    document.getElementById('showAllColumns').addEventListener('change', (e) => {
        if (e.target.checked) {
            // Zaznacz wszystkie opcje
            const select = document.getElementById('columnsToDisplay');
            for (let option of select.options) {
                option.selected = true;
            }
            updateSelectedColumns();
            renderTable();
        }
    });

    // Zmiana typu wykresu - pokaż/ukryj odpowiednie opcje
    document.getElementById('chartType').addEventListener('change', updateChartOptions);

    // Sortowanie tabeli
    document.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;
            handleSort(column);
        });
    });

    // Paginacja
    document.getElementById('pageSize').addEventListener('change', () => {
        appState.currentPage = 1;
        renderTable();
    });

    // Wykresy
    document.getElementById('generateChartBtn').addEventListener('click', generateChart);

    // Eksport
    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
}

// Główna funkcja wyszukiwania
async function handleSearch() {
    const voivCode = document.getElementById('voivodeshipSelect').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const appendMode = document.getElementById('appendMode').checked;
    
    // Walidacja
    if (!dateFrom || !dateTo) {
        alert('Wybierz zakres dat!');
        return;
    }
    
    if (new Date(dateFrom) > new Date(dateTo)) {
        alert('Data "od" nie może być późniejsza niż data "do"!');
        return;
    }
    
    // Pobierz filtry
    const filters = {
        brand: document.getElementById('brandFilter').value,
        model: document.getElementById('modelFilter').value,
        yearFrom: parseInt(document.getElementById('yearFrom').value) || null,
        yearTo: parseInt(document.getElementById('yearTo').value) || null,
        vehicleType: document.getElementById('vehicleTypeFilter').value,
        fuelType: document.getElementById('fuelTypeFilter').value
    };
    
    // Zapisz parametry wyszukiwania
    appState.searchParams = {
        voivodeship: voivCode === 'ALL' ? 'WSZYSTKIE' : VOIVODESHIPS[voivCode],
        dateFrom,
        dateTo,
        filters
    };
    
    showScreen('loading');
    
    try {
        let newVehicles = [];
        
        if (voivCode === 'ALL') {
            // Pobierz ze wszystkich województw
            newVehicles = await searchAllVoivodeships(dateFrom, dateTo, filters);
        } else {
            // Pobierz z jednego województwa
            newVehicles = await searchVoivodeship(voivCode, dateFrom, dateTo, filters);
        }
        
        // Dodaj batch ID i mapuj kody województw na nazwy
        appState.batchCounter++;
        newVehicles.forEach(v => {
            v._batch_id = appState.batchCounter;

            // Mapuj kod województwa na nazwę
            if (v.attributes && v.attributes['wojewodztwo']) {
                const voivCode = v.attributes['wojewodztwo'];
                if (VOIVODESHIPS[voivCode]) {
                    // Zachowaj oryginalny kod jako 'wojewodztwo-kod'
                    v.attributes['wojewodztwo-kod'] = voivCode;
                    // Zamień wartość 'wojewodztwo' na słowną nazwę
                    v.attributes['wojewodztwo'] = VOIVODESHIPS[voivCode];
                }
            }
        });

        // Append lub replace
        if (appendMode && appState.allVehicles.length > 0) {
            appState.allVehicles = [...appState.allVehicles, ...newVehicles];
        } else {
            appState.allVehicles = newVehicles;
        }
        
        if (appState.allVehicles.length === 0) {
            alert('Nie znaleziono żadnych pojazdów dla wybranych kryteriów.');
            showScreen('welcome');
            return;
        }

        // Wyczyść dynamiczne filtry przed zastosowaniem nowych
        appState.dynamicFilters = {};

        // Zastosuj filtry i pokaż wyniki
        applyFilters();
        showScreen('results');
        document.getElementById('clearBtn').style.display = 'block';

        // Pokaż info
        updateSearchInfo();

        // Automatycznie wygeneruj wykres po pobraniu danych
        // Zwiększony timeout aby UI było gotowe
        setTimeout(() => {
            console.log('Wywołanie generateAutoChart po timeout');
            console.log('Stan przed generowaniem wykresu:', {
                allVehicles: appState.allVehicles.length,
                filteredVehicles: appState.filteredVehicles.length,
                availableColumns: appState.availableColumns?.length
            });
            generateAutoChart();
        }, 1000);
        
    } catch (error) {
        console.error('Błąd wyszukiwania:', error);
        alert(`Błąd podczas wyszukiwania: ${error.message}`);
        showScreen('welcome');
    }
}

// Wyszukiwanie w jednym województwie
async function searchVoivodeship(code, dateFrom, dateTo, filters, progressCallback = null) {
    const dateFromAPI = formatDateAPI(dateFrom);
    const dateToAPI = formatDateAPI(dateTo);

    updateLoadingMessage(`Wyszukiwanie w ${VOIVODESHIPS[code]}...`);

    const params = new URLSearchParams({
        'wojewodztwo': code,
        'data-od': dateFromAPI,
        'data-do': dateToAPI,
        'limit': '500',
        'page': '1'
    });

    // Dodaj filtry API
    if (filters.brand) params.append('filter[marka]', filters.brand.toUpperCase());
    if (filters.model) params.append('filter[model]', filters.model.toUpperCase());
    if (filters.vehicleType) params.append('filter[rodzaj-pojazdu]', filters.vehicleType.toUpperCase());
    if (filters.fuelType) params.append('filter[rodzaj-paliwa]', filters.fuelType.toUpperCase());

    const vehicles = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        params.set('page', page);

        try {
            const response = await fetch(`${CONFIG.API_URL}/pojazdy?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                vehicles.push(...data.data);
                updateProgress(vehicles.length, data.meta?.count || vehicles.length);

                // Call progress callback if provided
                if (progressCallback) {
                    progressCallback(page, vehicles.length);
                }
            }

            // Sprawdź czy są kolejne strony
            hasMore = data.links && data.links.next;
            page++;

        } catch (error) {
            console.error(`Błąd na stronie ${page}:`, error);
            throw error;
        }
    }

    // Filtruj lokalnie po roku produkcji (API tego nie obsługuje)
    return filterByYear(vehicles, filters.yearFrom, filters.yearTo);
}

// Inicjalizacja statusów województw
function initVoivodeshipStatuses() {
    const codes = Object.keys(VOIVODESHIPS);
    appState.voivodeshipStatuses = {};

    codes.forEach(code => {
        appState.voivodeshipStatuses[code] = {
            code: code,
            name: VOIVODESHIPS[code],
            status: '⏳ Oczekuje...',
            count: 0,
            pages: 0,
            time: 0,
            startTime: null,
            error: null
        };
    });

    // Pokaż tabelę statusów
    document.getElementById('voivodeshipStatusTable').style.display = 'block';
    updateVoivodeshipStatusTable();
}

// Aktualizacja tabeli statusów województw
function updateVoivodeshipStatusTable() {
    const tbody = document.getElementById('voivodeshipStatusBody');
    tbody.innerHTML = '';

    const codes = Object.keys(appState.voivodeshipStatuses).sort();

    codes.forEach(code => {
        const status = appState.voivodeshipStatuses[code];
        const row = tbody.insertRow();

        row.insertCell().textContent = status.name;
        row.insertCell().textContent = status.status;
        row.insertCell().textContent = status.count;
        row.insertCell().textContent = status.pages;
        row.insertCell().textContent = status.time > 0 ? status.time.toFixed(1) : '-';
    });

    // Aktualizuj progress bar
    const completed = codes.filter(c => appState.voivodeshipStatuses[c].status.includes('✅')).length;
    const total = codes.length;
    updateProgress(completed, total);
}

// Wyszukiwanie we wszystkich województwach równolegle z trackingiem
async function searchAllVoivodeships(dateFrom, dateTo, filters) {
    const codes = Object.keys(VOIVODESHIPS);
    const allVehicles = [];
    const seenIds = new Set();

    updateLoadingMessage(`Odpytywanie ${codes.length} województw równolegle...`);

    // Inicjalizuj statusy
    initVoivodeshipStatuses();

    // Wykonaj zapytania w partiach (max 5 jednocześnie)
    for (let i = 0; i < codes.length; i += CONFIG.MAX_CONCURRENT_REQUESTS) {
        const batch = codes.slice(i, i + CONFIG.MAX_CONCURRENT_REQUESTS);

        const promises = batch.map(code =>
            searchVoivodeshipWithTracking(code, dateFrom, dateTo, filters)
                .catch(error => {
                    console.error(`Błąd dla ${VOIVODESHIPS[code]}:`, error);
                    appState.voivodeshipStatuses[code].status = '❌ Błąd';
                    appState.voivodeshipStatuses[code].error = error.message;
                    updateVoivodeshipStatusTable();
                    return [];
                })
        );

        const results = await Promise.all(promises);

        // Dodaj wyniki z deduplicacją
        results.flat().forEach(vehicle => {
            const id = vehicle.id;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                allVehicles.push(vehicle);
            }
        });
    }

    // Ukryj tabelę statusów po zakończeniu
    setTimeout(() => {
        document.getElementById('voivodeshipStatusTable').style.display = 'none';
    }, 3000);

    return allVehicles;
}

// Wyszukiwanie województwa z trackingiem statusu
async function searchVoivodeshipWithTracking(code, dateFrom, dateTo, filters) {
    const status = appState.voivodeshipStatuses[code];
    status.status = '🔄 Pobieranie...';
    status.startTime = Date.now();
    updateVoivodeshipStatusTable();

    try {
        const vehicles = await searchVoivodeship(code, dateFrom, dateTo, filters, (page, count) => {
            status.pages = page;
            status.count = count;
            updateVoivodeshipStatusTable();
        });

        status.status = '✅ Ukończono';
        status.count = vehicles.length;
        status.time = (Date.now() - status.startTime) / 1000;
        updateVoivodeshipStatusTable();

        return vehicles;
    } catch (error) {
        status.status = '❌ Błąd';
        status.error = error.message;
        status.time = (Date.now() - status.startTime) / 1000;
        updateVoivodeshipStatusTable();
        throw error;
    }
}

// Filtrowanie po roku produkcji (lokalnie)
function filterByYear(vehicles, yearFrom, yearTo) {
    if (!yearFrom && !yearTo) return vehicles;
    
    return vehicles.filter(v => {
        const year = v.attributes?.['rok-produkcji'];
        if (!year) return false;
        
        const yearNum = parseInt(year);
        if (yearFrom && yearNum < yearFrom) return false;
        if (yearTo && yearNum > yearTo) return false;
        return true;
    });
}

// Aktualizacja komunikatu ładowania
function updateLoadingMessage(message) {
    document.getElementById('loadingMessage').textContent = message;
}

// Aktualizacja paska postępu
function updateProgress(current, total) {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = `${percent}%`;
    progressBar.textContent = `${percent}% (${current}/${total})`;
}

// Przełączanie ekranów
function showScreen(screen) {
    document.getElementById('welcomeScreen').style.display = screen === 'welcome' ? 'block' : 'none';
    document.getElementById('loadingScreen').style.display = screen === 'loading' ? 'block' : 'none';
    document.getElementById('resultsScreen').style.display = screen === 'results' ? 'block' : 'none';
}

// Aktualizacja info o wyszukiwaniu
function updateSearchInfo() {
    const info = document.getElementById('searchInfo');
    const params = appState.searchParams;

    let html = `<strong>Województwo:</strong> ${params.voivodeship}<br>`;
    html += `<strong>Okres:</strong> ${params.dateFrom} - ${params.dateTo}<br>`;
    if (params.filters.brand) html += `<strong>Marka:</strong> ${params.filters.brand}<br>`;
    if (params.filters.model) html += `<strong>Model:</strong> ${params.filters.model}<br>`;
    html += `<strong>Liczba pojazdów:</strong> ${appState.allVehicles.length}`;

    info.innerHTML = html;

    // Pokaż per-batch statistics jeśli są różne batche
    updateBatchSummary();
}

// Aktualizacja podsumowania per-batch
function updateBatchSummary() {
    const batchSummaryDiv = document.getElementById('batchSummary');
    const batchCardsDiv = document.getElementById('batchCards');
    const batchTotalInfo = document.getElementById('batchTotalInfo');

    // Zbierz unikalne batch IDs
    const batchIds = [...new Set(appState.allVehicles.map(v => v._batch_id))].filter(Boolean);

    if (batchIds.length > 1) {
        // Mamy wiele zapytań - pokaż podsumowanie
        batchSummaryDiv.style.display = 'block';
        batchCardsDiv.innerHTML = '';

        batchIds.sort().forEach(batchId => {
            const batchVehicles = appState.allVehicles.filter(v => v._batch_id === batchId);

            const col = document.createElement('div');
            col.className = 'col-md-3';
            col.innerHTML = `
                <div class="card text-center">
                    <div class="card-body">
                        <h6 class="card-title">Zapytanie #${batchId}</h6>
                        <h3 class="text-primary">${batchVehicles.length}</h3>
                        <small class="text-muted">pojazdów</small>
                    </div>
                </div>
            `;
            batchCardsDiv.appendChild(col);
        });

        // Info o łącznej liczbie
        batchTotalInfo.innerHTML = `<strong>Łącznie:</strong> ${appState.allVehicles.length} pojazdów z ${batchIds.length} zapytań`;
    } else {
        // Tylko jedno zapytanie - ukryj sekcję
        batchSummaryDiv.style.display = 'none';
    }
}

// Zastosowanie filtrów
function applyFilters() {
    let filtered = [...appState.allVehicles];

    // Bezpieczne pobieranie elementów (mogą nie istnieć w DOM)
    const brandSelect = document.getElementById('filterBrand');
    const typeSelect = document.getElementById('filterVehicleType');
    const fuelSelect = document.getElementById('filterFuelType');

    // Filtr marki
    if (brandSelect) {
        const selectedBrands = Array.from(brandSelect.selectedOptions).map(o => o.value);
        if (selectedBrands.length > 0) {
            filtered = filtered.filter(v => selectedBrands.includes(v.attributes?.marka));
        }
    }

    // Filtr rodzaju pojazdu
    if (typeSelect) {
        const selectedTypes = Array.from(typeSelect.selectedOptions).map(o => o.value);
        if (selectedTypes.length > 0) {
            filtered = filtered.filter(v => selectedTypes.includes(v.attributes?.['rodzaj-pojazdu']));
        }
    }

    // Filtr paliwa
    if (fuelSelect) {
        const selectedFuels = Array.from(fuelSelect.selectedOptions).map(o => o.value);
        if (selectedFuels.length > 0) {
            filtered = filtered.filter(v => selectedFuels.includes(v.attributes?.['rodzaj-paliwa']));
        }
    }

    // Filtr roku
    const yearRange = document.getElementById('filterYearRange');
    if (yearRange) {
        const maxYear = parseInt(yearRange.value);
        const minYear = parseInt(yearRange.min);
        const rangeMax = parseInt(yearRange.max);
        if (maxYear < rangeMax) {
            filtered = filtered.filter(v => {
                const year = parseInt(v.attributes?.['rok-produkcji']);
                return year >= minYear && year <= maxYear;
            });
        }
    }

    // Zastosuj dynamiczne filtry
    Object.entries(appState.dynamicFilters).forEach(([column, filterValue]) => {
        if (Array.isArray(filterValue)) {
            // Kategoryczny filtr (multi-select)
            if (filterValue.length > 0) {
                filtered = filtered.filter(v => filterValue.includes(v.attributes?.[column]));
            }
        } else if (typeof filterValue === 'object' && filterValue.min !== undefined && filterValue.max !== undefined) {
            // Numeryczny filtr (range)
            filtered = filtered.filter(v => {
                const val = parseFloat(v.attributes?.[column]);
                if (isNaN(val)) return false;
                return val >= filterValue.min && val <= filterValue.max;
            });
        }
    });

    appState.filteredVehicles = filtered;
    appState.currentPage = 1;

    console.log(`Filtry zastosowane: ${appState.allVehicles.length} -> ${appState.filteredVehicles.length} pojazdów`);

    // Aktualizuj UI
    updateStatistics();
    updateFilterOptions();
    renderTable();
}

// Reset filtrów
function resetFilters() {
    document.getElementById('filterBrand').selectedIndex = -1;
    document.getElementById('filterVehicleType').selectedIndex = -1;
    document.getElementById('filterFuelType').selectedIndex = -1;
    document.getElementById('filterYearRange').value = document.getElementById('filterYearRange').max;
    document.getElementById('filterYearMax').textContent = document.getElementById('filterYearRange').max;

    // Reset dynamicznych filtrów
    appState.dynamicFilters = {};
    document.getElementById('dynamicFiltersContainer').innerHTML = '';
    document.getElementById('columnsToFilter').selectedIndex = -1;

    applyFilters();
}

// Aktualizacja dynamicznych filtrów
function updateDynamicFilters() {
    const select = document.getElementById('columnsToFilter');
    const container = document.getElementById('dynamicFiltersContainer');
    const selectedColumns = Array.from(select.selectedOptions).map(o => o.value);

    // Wyczyść dynamiczne filtry
    appState.dynamicFilters = {};
    container.innerHTML = '';

    if (selectedColumns.length === 0) {
        applyFilters();
        return;
    }

    // Dla każdej wybranej kolumny stwórz odpowiedni filtr
    selectedColumns.forEach((column, idx) => {
        const col = document.createElement('div');
        col.className = 'col-md-6';

        // Sprawdź typ kolumny
        const values = appState.allVehicles.map(v => v.attributes?.[column]).filter(Boolean);
        const uniqueValues = [...new Set(values)];
        const isNumeric = values.every(v => !isNaN(parseFloat(v)));

        if (isNumeric && uniqueValues.length > 20) {
            // Numeryczny filtr (podwójny suwak od-do)
            const numericValues = values.map(v => parseFloat(v));
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);

            col.innerHTML = `
                <label class="form-label"><strong>🔢 ${column}</strong></label>
                <div class="range-slider-container">
                    <!-- Pola input do wpisania wartości -->
                    <div class="row g-2 mb-2">
                        <div class="col-6">
                            <label class="form-label small mb-0">Od:</label>
                            <input type="number" class="form-control form-control-sm"
                                id="dynamicFilterMinInput_${idx}"
                                value="${min}"
                                min="${min}"
                                max="${max}"
                                step="1">
                        </div>
                        <div class="col-6">
                            <label class="form-label small mb-0">Do:</label>
                            <input type="number" class="form-control form-control-sm"
                                id="dynamicFilterMaxInput_${idx}"
                                value="${max}"
                                min="${min}"
                                max="${max}"
                                step="1">
                        </div>
                    </div>

                    <!-- Podwójny suwak -->
                    <div class="double-range-slider">
                        <input type="range" class="form-range range-min"
                            id="dynamicFilterMinSlider_${idx}"
                            min="${min}"
                            max="${max}"
                            value="${min}"
                            step="1">
                        <input type="range" class="form-range range-max"
                            id="dynamicFilterMaxSlider_${idx}"
                            min="${min}"
                            max="${max}"
                            value="${max}"
                            step="1">
                    </div>

                    <div class="d-flex justify-content-between mt-1">
                        <small class="text-muted">${min.toFixed(0)}</small>
                        <small class="text-muted" id="dynamicFilterRangeDisplay_${idx}">
                            ${min.toFixed(0)} - ${max.toFixed(0)}
                        </small>
                        <small class="text-muted">${max.toFixed(0)}</small>
                    </div>
                </div>
            `;

            container.appendChild(col);

            // Event listeners - synchronizacja suwaków i inputów
            setTimeout(() => {
                const minInput = document.getElementById(`dynamicFilterMinInput_${idx}`);
                const maxInput = document.getElementById(`dynamicFilterMaxInput_${idx}`);
                const minSlider = document.getElementById(`dynamicFilterMinSlider_${idx}`);
                const maxSlider = document.getElementById(`dynamicFilterMaxSlider_${idx}`);
                const rangeDisplay = document.getElementById(`dynamicFilterRangeDisplay_${idx}`);

                const updateFilter = () => {
                    let minVal = parseFloat(minInput.value);
                    let maxVal = parseFloat(maxInput.value);

                    // Walidacja - min nie może być większe niż max
                    if (minVal > maxVal) {
                        minVal = maxVal;
                        minInput.value = minVal;
                        minSlider.value = minVal;
                    }

                    // Aktualizuj wyświetlany zakres
                    rangeDisplay.textContent = `${minVal.toFixed(0)} - ${maxVal.toFixed(0)}`;

                    // Zastosuj filtr
                    appState.dynamicFilters[column] = {
                        min: minVal,
                        max: maxVal
                    };
                    applyFilters();
                };

                // Synchronizacja input -> slider
                minInput.addEventListener('input', () => {
                    minSlider.value = minInput.value;
                    updateFilter();
                });

                maxInput.addEventListener('input', () => {
                    maxSlider.value = maxInput.value;
                    updateFilter();
                });

                // Synchronizacja slider -> input
                minSlider.addEventListener('input', () => {
                    const val = parseFloat(minSlider.value);
                    const maxVal = parseFloat(maxSlider.value);

                    // Nie pozwól minSlider przesunąć się powyżej maxSlider
                    if (val > maxVal) {
                        minSlider.value = maxVal;
                        minInput.value = maxVal;
                    } else {
                        minInput.value = val;
                    }
                    updateFilter();
                });

                maxSlider.addEventListener('input', () => {
                    const val = parseFloat(maxSlider.value);
                    const minVal = parseFloat(minSlider.value);

                    // Nie pozwól maxSlider przesunąć się poniżej minSlider
                    if (val < minVal) {
                        maxSlider.value = minVal;
                        maxInput.value = minVal;
                    } else {
                        maxInput.value = val;
                    }
                    updateFilter();
                });
            }, 10);
        } else {
            // Kategoryczny filtr (multi-select)
            const sortedValues = [...uniqueValues].sort().slice(0, 50); // Max 50 opcji

            col.innerHTML = `
                <label class="form-label"><strong>📌 ${column}</strong></label>
                <select class="form-select" id="dynamicFilter_${idx}" data-column="${column}" multiple size="5">
                    ${sortedValues.map(v => `<option value="${v}">${v}</option>`).join('')}
                </select>
            `;

            container.appendChild(col);

            // Event listener
            setTimeout(() => {
                document.getElementById(`dynamicFilter_${idx}`).addEventListener('change', (e) => {
                    const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                    if (selected.length > 0) {
                        appState.dynamicFilters[column] = selected;
                    } else {
                        delete appState.dynamicFilters[column];
                    }
                    applyFilters();
                });
            }, 10);
        }
    });
}

// Aktualizacja wybranych kolumn do wyświetlenia
function updateSelectedColumns() {
    const select = document.getElementById('columnsToDisplay');
    appState.selectedColumns = Array.from(select.selectedOptions).map(o => o.value);
}

// Aktualizacja opcji wykresu w zależności od typu
function updateChartOptions() {
    const chartType = document.getElementById('chartType').value;
    const columnXContainer = document.getElementById('chartColumnXContainer');
    const columnYContainer = document.getElementById('chartColumnYContainer');
    const topNContainer = document.getElementById('chartTopNContainer');
    const columnXLabel = document.getElementById('chartColumnXLabel');

    if (chartType === 'scatter' || chartType === 'box') {
        // Pokaż kolumnę Y
        columnYContainer.style.display = 'block';
        topNContainer.style.display = 'none';

        if (chartType === 'scatter') {
            columnXLabel.textContent = 'Kolumna X';
        } else {
            columnXLabel.textContent = 'Kategoria (X)';
        }
    } else {
        // Ukryj kolumnę Y
        columnYContainer.style.display = 'none';
        topNContainer.style.display = 'block';
        columnXLabel.textContent = chartType === 'histogram' ? 'Kolumna do analizy' : 'Kolumna do analizy';
    }
}

// Aktualizacja opcji filtrów (na podstawie danych)
function updateFilterOptions() {
    const vehicles = appState.allVehicles;

    // Zbierz unikalne wartości
    const brands = new Set();
    const types = new Set();
    const fuels = new Set();
    let minYear = 9999, maxYear = 0;

    // Zbierz wszystkie dostępne kolumny
    const allColumns = new Set();

    vehicles.forEach(v => {
        const attrs = v.attributes || {};
        if (attrs.marka) brands.add(attrs.marka);
        if (attrs['rodzaj-pojazdu']) types.add(attrs['rodzaj-pojazdu']);
        if (attrs['rodzaj-paliwa']) fuels.add(attrs['rodzaj-paliwa']);

        const year = parseInt(attrs['rok-produkcji']);
        if (year) {
            minYear = Math.min(minYear, year);
            maxYear = Math.max(maxYear, year);
        }

        // Zbierz nazwy wszystkich kolumn
        Object.keys(attrs).forEach(key => allColumns.add(key));
    });

    // Aktualizuj selecty (jeśli są puste lub pochodzą z danych)
    populateMultiSelect('filterBrand', Array.from(brands).sort());
    populateMultiSelect('filterVehicleType', Array.from(types).sort());
    populateMultiSelect('filterFuelType', Array.from(fuels).sort());

    // Aktualizuj slider roku
    const yearRange = document.getElementById('filterYearRange');
    yearRange.min = minYear;
    yearRange.max = maxYear;
    yearRange.value = maxYear;
    document.getElementById('filterYearMin').textContent = minYear;
    document.getElementById('filterYearMax').textContent = maxYear;

    // Inicjalizuj opcje dla dynamicznych filtrów
    const columnsToFilterSelect = document.getElementById('columnsToFilter');
    columnsToFilterSelect.innerHTML = '';
    const excludedColumns = ['id', '_batch_id']; // Wyklucz te kolumny
    const sortedColumns = Array.from(allColumns).filter(c => !excludedColumns.includes(c)).sort();
    sortedColumns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        columnsToFilterSelect.appendChild(option);
    });

    // Inicjalizuj opcje dla wyboru kolumn do wyświetlenia
    const columnsToDisplaySelect = document.getElementById('columnsToDisplay');
    columnsToDisplaySelect.innerHTML = '';

    // Domyślne kolumny
    const defaultColumns = ['marka', 'model', 'rok-produkcji', 'rodzaj-pojazdu', 'rodzaj-paliwa', 'pojemnosc-skokowa-silnika', 'masa-wlasna'];
    appState.availableColumns = sortedColumns;

    sortedColumns.forEach(col => {
        const option = document.createElement('option');
        option.value = col;
        option.textContent = col;
        if (defaultColumns.includes(col)) {
            option.selected = true;
        }
        columnsToDisplaySelect.appendChild(option);
    });

    // Zapisz wybrane kolumny
    updateSelectedColumns();

    // Aktualizuj opcje wykresów
    updateChartColumnOptions(sortedColumns);
}

// Aktualizacja opcji kolumn w wykresach
function updateChartColumnOptions(columns) {
    const chartColumn = document.getElementById('chartColumn');
    const chartColumnY = document.getElementById('chartColumnY');

    // Zapisz aktualnie wybraną wartość
    const currentX = chartColumn.value;
    const currentY = chartColumnY.value;

    // Aktualizuj opcje
    chartColumn.innerHTML = columns.map(col => `<option value="${col}">${col}</option>`).join('');
    chartColumnY.innerHTML = columns.map(col => `<option value="${col}">${col}</option>`).join('');

    // Przywróć wybrane wartości jeśli istnieją
    if (columns.includes(currentX)) chartColumn.value = currentX;
    if (columns.includes(currentY)) chartColumnY.value = currentY;
}

// Wypełnianie multi-select
function populateMultiSelect(selectId, values) {
    const select = document.getElementById(selectId);
    const currentValues = Array.from(select.selectedOptions).map(o => o.value);
    
    select.innerHTML = '';
    values.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (currentValues.includes(value)) option.selected = true;
        select.appendChild(option);
    });
}

// Aktualizacja statystyk
function updateStatistics() {
    const total = appState.allVehicles.length;
    const filtered = appState.filteredVehicles.length;
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statFiltered').textContent = filtered;
    
    // Unikalne marki
    const brands = new Set(appState.filteredVehicles.map(v => v.attributes?.marka).filter(Boolean));
    document.getElementById('statBrands').textContent = brands.size;
    
    // Średni rok
    const years = appState.filteredVehicles
        .map(v => parseInt(v.attributes?.['rok-produkcji']))
        .filter(y => !isNaN(y));
    const avgYear = years.length > 0 ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : 0;
    document.getElementById('statAvgYear').textContent = avgYear;
    
    // Procent
    const percent = total > 0 ? ((filtered / total) * 100).toFixed(1) : 0;
    document.getElementById('statPercent').textContent = `${percent}%`;
}

// Sortowanie
function handleSort(column) {
    if (appState.sortColumn === column) {
        appState.sortDirection = appState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        appState.sortColumn = column;
        appState.sortDirection = 'asc';
    }
    
    appState.filteredVehicles.sort((a, b) => {
        let valA = a.attributes?.[column];
        let valB = b.attributes?.[column];
        
        // Konwersja do liczb jeśli możliwe
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
            valA = numA;
            valB = numB;
        }
        
        if (valA < valB) return appState.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return appState.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    renderTable();
}

// Renderowanie tabeli
function renderTable() {
    const thead = document.getElementById('vehiclesTableHead');
    const tbody = document.getElementById('vehiclesTableBody');
    const pageSize = parseInt(document.getElementById('pageSize').value);
    const start = (appState.currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = appState.filteredVehicles.slice(start, end);

    // Użyj wybranych kolumn lub domyślnych
    const columns = appState.selectedColumns.length > 0 ? appState.selectedColumns :
        ['marka', 'model', 'rok-produkcji', 'rodzaj-pojazdu', 'rodzaj-paliwa', 'pojemnosc-skokowa-silnika', 'masa-wlasna'];

    // Aktualizuj nagłówki tabeli
    thead.innerHTML = '';
    const headerRow = thead.insertRow();
    headerRow.insertCell().textContent = 'Lp.';

    columns.forEach(col => {
        const th = document.createElement('th');
        th.className = 'sortable';
        th.dataset.column = col;
        th.innerHTML = `${col} <i class="bi bi-arrow-down-up"></i>`;
        th.addEventListener('click', () => handleSort(col));
        headerRow.appendChild(th);
    });

    // Wypełnij wiersze
    tbody.innerHTML = '';

    pageData.forEach((vehicle, idx) => {
        const attrs = vehicle.attributes || {};
        const row = tbody.insertRow();

        row.insertCell().textContent = start + idx + 1;

        columns.forEach(col => {
            row.insertCell().textContent = attrs[col] || '-';
        });
    });

    renderPagination();
}

// Renderowanie paginacji
function renderPagination() {
    const pagination = document.getElementById('pagination');
    const pageSize = parseInt(document.getElementById('pageSize').value);
    const totalPages = Math.ceil(appState.filteredVehicles.length / pageSize);
    
    pagination.innerHTML = '';
    
    // Previous
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${appState.currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = '<a class="page-link" href="#">«</a>';
    prevLi.addEventListener('click', (e) => {
        e.preventDefault();
        if (appState.currentPage > 1) {
            appState.currentPage--;
            renderTable();
        }
    });
    pagination.appendChild(prevLi);
    
    // Pages (pokaż max 5)
    const startPage = Math.max(1, appState.currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === appState.currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener('click', (e) => {
            e.preventDefault();
            appState.currentPage = i;
            renderTable();
        });
        pagination.appendChild(li);
    }
    
    // Next
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${appState.currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = '<a class="page-link" href="#">»</a>';
    nextLi.addEventListener('click', (e) => {
        e.preventDefault();
        if (appState.currentPage < totalPages) {
            appState.currentPage++;
            renderTable();
        }
    });
    pagination.appendChild(nextLi);
}

// Automatyczne generowanie wykresu po pobraniu danych
function generateAutoChart() {
    // Sprawdź czy są dane
    const dataLength = appState.filteredVehicles.length > 0 ? appState.filteredVehicles.length : appState.allVehicles.length;

    console.log('Auto-generowanie wykresu:', {
        allVehicles: appState.allVehicles.length,
        filteredVehicles: appState.filteredVehicles.length,
        availableColumns: appState.availableColumns?.length
    });

    if (dataLength === 0) {
        console.warn('Brak danych do automatycznego wygenerowania wykresu');
        return;
    }

    // Wybierz odpowiednią kolumnę do wizualizacji
    const availableColumns = appState.availableColumns || [];
    let columnToVisualize = null;

    // Priorytety kolumn do wizualizacji
    const priorityColumns = ['marka', 'rodzaj-pojazdu', 'rodzaj-paliwa', 'rok-produkcji'];

    for (const col of priorityColumns) {
        if (availableColumns.includes(col)) {
            columnToVisualize = col;
            break;
        }
    }

    // Jeśli nie znaleziono priorytetowej kolumny, użyj pierwszej dostępnej
    if (!columnToVisualize && availableColumns.length > 0) {
        columnToVisualize = availableColumns[0];
    }

    if (!columnToVisualize) {
        console.warn('Brak dostępnych kolumn do wizualizacji');
        return;
    }

    console.log(`Wybrano kolumnę do wizualizacji: ${columnToVisualize}`);

    // Ustaw parametry wykresu
    document.getElementById('chartColumn').value = columnToVisualize;
    document.getElementById('chartType').value = 'bar';

    // Wygeneruj wykres
    try {
        generateChart();
        console.log('Wykres wygenerowany pomyślnie');
    } catch (error) {
        console.error('Błąd generowania wykresu:', error);
    }

    // Scroll do wykresu
    setTimeout(() => {
        const chartContainer = document.getElementById('chartContainer');
        if (chartContainer) {
            chartContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
}

// Generowanie wykresów
function generateChart() {
    const chartType = document.getElementById('chartType').value;
    const column = document.getElementById('chartColumn').value;
    const columnY = document.getElementById('chartColumnY').value;
    const topN = parseInt(document.getElementById('chartTopN').value);

    // Użyj filteredVehicles jeśli istnieją, w przeciwnym razie allVehicles
    const data = appState.filteredVehicles.length > 0 ? appState.filteredVehicles : appState.allVehicles;

    console.log(`Generowanie wykresu: typ=${chartType}, kolumna=${column}, dane=${data.length}`);

    if (data.length === 0) {
        console.error('Brak danych do wizualizacji!', {
            allVehicles: appState.allVehicles.length,
            filteredVehicles: appState.filteredVehicles.length
        });
        alert('Brak danych do wizualizacji! Spróbuj zresetować filtry.');
        return;
    }

    // Sprawdź czy mamy wiele batchy (dla kolorowania)
    const batchIds = [...new Set(data.map(v => v._batch_id))].filter(Boolean);
    const hasBatches = batchIds.length > 1;

    const container = document.getElementById('chartContainer');

    if (chartType === 'bar') {
        const values = data.map(v => v.attributes?.[column]).filter(Boolean);
        if (values.length === 0) {
            alert('Brak danych dla wybranej kolumny!');
            return;
        }

        if (hasBatches) {
            // Grupuj po kolumnie i batch_id
            const traces = [];
            batchIds.forEach(batchId => {
                const batchData = data.filter(v => v._batch_id === batchId);
                const counts = {};
                batchData.forEach(v => {
                    const val = v.attributes?.[column];
                    if (val) counts[val] = (counts[val] || 0) + 1;
                });
                const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN);
                traces.push({
                    x: sorted.map(([, count]) => count),
                    y: sorted.map(([label]) => label),
                    name: `Zapytanie #${batchId}`,
                    type: 'bar',
                    orientation: 'h'
                });
            });
            const layout = {
                title: `Top ${topN}: ${column} (według zapytań)`,
                xaxis: { title: 'Liczba' },
                yaxis: { title: column },
                height: 500,
                barmode: 'group'
            };
            Plotly.newPlot(container, traces, layout);
        } else {
            const counts = {};
            values.forEach(v => counts[v] = (counts[v] || 0) + 1);
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN);
            const trace = {
                x: sorted.map(([, count]) => count),
                y: sorted.map(([label]) => label),
                type: 'bar',
                orientation: 'h',
                marker: { color: 'rgb(55, 83, 109)' }
            };
            const layout = {
                title: `Top ${topN}: ${column}`,
                xaxis: { title: 'Liczba' },
                yaxis: { title: column },
                height: 500
            };
            Plotly.newPlot(container, [trace], layout);
        }

    } else if (chartType === 'pie') {
        const values = data.map(v => v.attributes?.[column]).filter(Boolean);
        if (values.length === 0) {
            alert('Brak danych dla wybranej kolumny!');
            return;
        }
        const counts = {};
        values.forEach(v => counts[v] = (counts[v] || 0) + 1);
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN);
        const trace = {
            labels: sorted.map(([label]) => label),
            values: sorted.map(([, count]) => count),
            type: 'pie'
        };
        const layout = {
            title: `Rozkład: ${column}`,
            height: 500
        };
        Plotly.newPlot(container, [trace], layout);

    } else if (chartType === 'histogram') {
        const values = data.map(v => v.attributes?.[column]).filter(Boolean);
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

        if (numericValues.length === 0) {
            alert('Kolumna nie zawiera wartości numerycznych!');
            return;
        }

        if (hasBatches) {
            // Histogram z kolorowaniem według batch
            const traces = [];
            batchIds.forEach(batchId => {
                const batchData = data.filter(v => v._batch_id === batchId);
                const batchValues = batchData.map(v => parseFloat(v.attributes?.[column])).filter(v => !isNaN(v));
                traces.push({
                    x: batchValues,
                    name: `Zapytanie #${batchId}`,
                    type: 'histogram',
                    opacity: 0.6
                });
            });
            const layout = {
                title: `Histogram: ${column} (według zapytań)`,
                xaxis: { title: column },
                yaxis: { title: 'Liczba' },
                height: 500,
                barmode: 'overlay'
            };
            Plotly.newPlot(container, traces, layout);
        } else {
            const trace = {
                x: numericValues,
                type: 'histogram',
                marker: { color: 'rgb(55, 83, 109)' }
            };
            const layout = {
                title: `Histogram: ${column}`,
                xaxis: { title: column },
                yaxis: { title: 'Liczba' },
                height: 500
            };
            Plotly.newPlot(container, [trace], layout);
        }

    } else if (chartType === 'scatter') {
        // Scatter plot
        const dataPoints = data.map(v => ({
            x: parseFloat(v.attributes?.[column]),
            y: parseFloat(v.attributes?.[columnY]),
            batch: v._batch_id
        })).filter(d => !isNaN(d.x) && !isNaN(d.y));

        if (dataPoints.length === 0) {
            alert('Brak danych numerycznych dla wybranych kolumn!');
            return;
        }

        if (hasBatches) {
            const traces = [];
            batchIds.forEach(batchId => {
                const batchPoints = dataPoints.filter(d => d.batch === batchId);
                traces.push({
                    x: batchPoints.map(d => d.x),
                    y: batchPoints.map(d => d.y),
                    name: `Zapytanie #${batchId}`,
                    mode: 'markers',
                    type: 'scatter',
                    marker: { size: 6, opacity: 0.6 }
                });
            });
            const layout = {
                title: `Scatter: ${column} vs ${columnY}`,
                xaxis: { title: column },
                yaxis: { title: columnY },
                height: 500
            };
            Plotly.newPlot(container, traces, layout);
        } else {
            const trace = {
                x: dataPoints.map(d => d.x),
                y: dataPoints.map(d => d.y),
                mode: 'markers',
                type: 'scatter',
                marker: { size: 6, color: 'rgb(55, 83, 109)', opacity: 0.6 }
            };
            const layout = {
                title: `Scatter: ${column} vs ${columnY}`,
                xaxis: { title: column },
                yaxis: { title: columnY },
                height: 500
            };
            Plotly.newPlot(container, [trace], layout);
        }

    } else if (chartType === 'box') {
        // Box plot
        const dataPoints = data.map(v => ({
            x: v.attributes?.[column],
            y: parseFloat(v.attributes?.[columnY]),
            batch: v._batch_id
        })).filter(d => d.x && !isNaN(d.y));

        if (dataPoints.length === 0) {
            alert('Brak odpowiednich danych dla Box Plot!');
            return;
        }

        if (hasBatches) {
            const traces = [];
            batchIds.forEach(batchId => {
                const batchPoints = dataPoints.filter(d => d.batch === batchId);
                traces.push({
                    x: batchPoints.map(d => d.x),
                    y: batchPoints.map(d => d.y),
                    name: `Zapytanie #${batchId}`,
                    type: 'box'
                });
            });
            const layout = {
                title: `Box Plot: ${columnY} według ${column}`,
                xaxis: { title: column },
                yaxis: { title: columnY },
                height: 500
            };
            Plotly.newPlot(container, traces, layout);
        } else {
            const trace = {
                x: dataPoints.map(d => d.x),
                y: dataPoints.map(d => d.y),
                type: 'box'
            };
            const layout = {
                title: `Box Plot: ${columnY} według ${column}`,
                xaxis: { title: column },
                yaxis: { title: columnY },
                height: 500
            };
            Plotly.newPlot(container, [trace], layout);
        }
    }
}

// Eksport do CSV
function exportCSV() {
    const data = appState.filteredVehicles;
    
    if (data.length === 0) {
        alert('Brak danych do eksportu!');
        return;
    }
    
    // Nagłówki
    const headers = ['id', 'marka', 'model', 'rok-produkcji', 'rodzaj-pojazdu', 'rodzaj-paliwa', 
                     'pojemnosc-skokowa-silnika', 'masa-wlasna', 'wojewodztwo'];
    
    // Wiersze
    const rows = data.map(v => {
        const attrs = v.attributes || {};
        return headers.map(h => {
            let val = h === 'id' ? v.id : attrs[h];
            val = val || '';
            // Escape dla CSV
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        }).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Pobierz
    downloadFile(csv, 'cepik_export.csv', 'text/csv;charset=utf-8;');
}

// Eksport do JSON
function exportJSON() {
    const data = appState.filteredVehicles;
    
    if (data.length === 0) {
        alert('Brak danych do eksportu!');
        return;
    }
    
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, 'cepik_export.json', 'application/json');
}

// Pobieranie pliku
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

console.log('app.js załadowany');

