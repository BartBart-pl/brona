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
    // API_URL: '/api',

    // Dla produkcji (GitHub Pages + Cloudflare Worker):
    API_URL: 'https://wispy-sunset-6278.bartlomiej-bartczak.workers.dev',

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

// Helper function: Mapuj kod województwa na nazwę (lub zwróć wartość jeśli nie jest kodem)
function mapVoivodeshipValue(value) {
    if (!value) return value;
    // Sprawdź czy to kod województwa (2-cyfrowy string)
    if (typeof value === 'string' && /^\d{2}$/.test(value) && VOIVODESHIPS[value]) {
        return VOIVODESHIPS[value];
    }
    return value;
}

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

// ===========================
// TOAST NOTIFICATIONS
// ===========================

function showToast(message, type = 'info', duration = 3000) {
    const backgrounds = {
        success: 'linear-gradient(to right, #00b09b, #96c93d)',
        error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        warning: 'linear-gradient(to right, #f7971e, #ffd200)',
        info: 'linear-gradient(to right, #0077b6, #48cae4)'
    };

    Toastify({
        text: message,
        duration: duration,
        gravity: 'top',
        position: 'right',
        stopOnFocus: true,
        style: {
            background: backgrounds[type] || backgrounds.info,
            borderRadius: '8px',
            padding: '12px 20px',
            fontSize: '14px'
        }
    }).showToast();
}

// Convenience functions
function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error', 5000);
}

function showWarning(message) {
    showToast(message, 'warning', 4000);
}

function showInfo(message) {
    showToast(message, 'info');
}

// ===========================
// INDEXEDDB CACHE
// ===========================

let db = null;
const DB_NAME = 'BronaCacheDB';
const DB_VERSION = 1;
const CACHE_STORE = 'apiCache';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 godziny

async function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('❌ Błąd otwierania IndexedDB:', request.error);
            resolve(null); // Kontynuuj bez cache
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('✅ IndexedDB zainicjalizowane');
            // Wyczyść stare cache przy starcie
            cleanExpiredCache();
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;

            // Utwórz object store jeśli nie istnieje
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
                const objectStore = db.createObjectStore(CACHE_STORE, { keyPath: 'cacheKey' });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('✅ Utworzono object store:', CACHE_STORE);
            }
        };
    });
}

async function getCachedData(cacheKey) {
    if (!db) return null;

    return new Promise((resolve) => {
        const transaction = db.transaction([CACHE_STORE], 'readonly');
        const objectStore = transaction.objectStore(CACHE_STORE);
        const request = objectStore.get(cacheKey);

        request.onsuccess = () => {
            const result = request.result;

            if (!result) {
                resolve(null);
                return;
            }

            // Sprawdź czy nie wygasło
            const age = Date.now() - result.timestamp;
            if (age > CACHE_EXPIRY_MS) {
                console.log(`⏰ Cache wygasło dla: ${cacheKey}`);
                deleteCachedData(cacheKey);
                resolve(null);
                return;
            }

            console.log(`✅ Cache hit: ${cacheKey} (wiek: ${(age / 1000 / 60).toFixed(1)}min)`);
            resolve(result.data);
        };

        request.onerror = () => {
            console.error('❌ Błąd odczytu cache:', request.error);
            resolve(null);
        };
    });
}

async function setCachedData(cacheKey, data) {
    if (!db) return false;

    return new Promise((resolve) => {
        const transaction = db.transaction([CACHE_STORE], 'readwrite');
        const objectStore = transaction.objectStore(CACHE_STORE);

        const record = {
            cacheKey,
            data,
            timestamp: Date.now()
        };

        const request = objectStore.put(record);

        request.onsuccess = () => {
            console.log(`✅ Cache zapisane: ${cacheKey}`);
            resolve(true);
        };

        request.onerror = () => {
            console.error('❌ Błąd zapisu cache:', request.error);
            resolve(false);
        };
    });
}

async function deleteCachedData(cacheKey) {
    if (!db) return;

    const transaction = db.transaction([CACHE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(CACHE_STORE);
    objectStore.delete(cacheKey);
}

async function cleanExpiredCache() {
    if (!db) return;

    const transaction = db.transaction([CACHE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(CACHE_STORE);
    const index = objectStore.index('timestamp');
    const range = IDBKeyRange.upperBound(Date.now() - CACHE_EXPIRY_MS);

    const request = index.openCursor(range);
    let deleted = 0;

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            cursor.delete();
            deleted++;
            cursor.continue();
        } else if (deleted > 0) {
            console.log(`🗑️ Usunięto ${deleted} wygasłych rekordów cache`);
        }
    };
}

function generateCacheKey(voivCode, dateFrom, dateTo, filters) {
    const key = `${voivCode}_${dateFrom}_${dateTo}_${JSON.stringify(filters)}`;
    return key;
}

// ===========================
// DARK MODE
// ===========================

function initDarkMode() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);

    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
}

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    showInfo(`🌓 Przełączono na tryb ${newTheme === 'dark' ? 'ciemny' : 'jasny'}`);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update icon
    const icon = document.getElementById('darkModeIcon');
    if (theme === 'dark') {
        icon.className = 'bi bi-sun-fill';
    } else {
        icon.className = 'bi bi-moon-fill';
    }
}

// ===========================
// LOCALSTORAGE - FILTERS PERSISTENCE
// ===========================

function saveFiltersToStorage() {
    const filters = {
        brand: document.getElementById('brandFilter').value,
        model: document.getElementById('modelFilter').value,
        yearFrom: document.getElementById('yearFrom').value,
        yearTo: document.getElementById('yearTo').value,
        vehicleType: document.getElementById('vehicleTypeFilter').value,
        fuelType: document.getElementById('fuelTypeFilter').value,
        voivodeship: document.getElementById('voivodeshipSelect').value,
        appendMode: document.getElementById('appendMode').checked
    };

    localStorage.setItem('savedFilters', JSON.stringify(filters));
    console.log('✅ Filtry zapisane do localStorage');
}

function loadFiltersFromStorage() {
    const saved = localStorage.getItem('savedFilters');
    if (!saved) return false;

    try {
        const filters = JSON.parse(saved);

        // Przywróć wartości (tylko jeśli elementy istnieją)
        if (filters.brand && document.getElementById('brandFilter')) {
            document.getElementById('brandFilter').value = filters.brand;
        }
        if (filters.model && document.getElementById('modelFilter')) {
            document.getElementById('modelFilter').value = filters.model;
        }
        if (filters.yearFrom) document.getElementById('yearFrom').value = filters.yearFrom;
        if (filters.yearTo) document.getElementById('yearTo').value = filters.yearTo;
        if (filters.vehicleType && document.getElementById('vehicleTypeFilter')) {
            document.getElementById('vehicleTypeFilter').value = filters.vehicleType;
        }
        if (filters.fuelType && document.getElementById('fuelTypeFilter')) {
            document.getElementById('fuelTypeFilter').value = filters.fuelType;
        }
        if (filters.voivodeship) {
            document.getElementById('voivodeshipSelect').value = filters.voivodeship;
        }
        if (filters.appendMode !== undefined) {
            document.getElementById('appendMode').checked = filters.appendMode;
        }

        console.log('✅ Przywrócono filtry z localStorage');
        return true;
    } catch (e) {
        console.error('❌ Błąd ładowania filtrów:', e);
        return false;
    }
}

// Inicjalizacja aplikacji
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicjalizacja aplikacji BRONA...');

    // Inicjalizuj Dark Mode
    initDarkMode();

    // Załaduj województwa
    loadVoivodeships();

    // Inicjalizuj IndexedDB cache
    await initIndexedDB();

    // Załaduj zapisane filtry po załadowaniu słowników
    setTimeout(() => {
        if (loadFiltersFromStorage()) {
            showInfo('📋 Przywrócono ostatnie filtry');
        }
    }, 1000);
    
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

// Setup filtra zakresu roku produkcji
function setupYearRangeFilter() {
    const minInput = document.getElementById('filterYearMinInput');
    const maxInput = document.getElementById('filterYearMaxInput');

    const updateFilter = () => {
        applyFilters();
    };

    // Filtruj przy zmianie wartości
    minInput.addEventListener('change', updateFilter);
    maxInput.addEventListener('change', updateFilter);
}

// Setup enhanced multi-select (klik=toggle, drag=select, shift=range)
function setupEnhancedMultiSelect() {
    const multiSelects = document.querySelectorAll('.multi-select-enhanced');

    multiSelects.forEach(select => {
        let isDragging = false;
        let lastSelectedIndex = -1;
        let dragStartSelected = false;

        // Zapobiegaj domyślnemu zachowaniu multi-select
        select.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'OPTION') {
                e.preventDefault();

                const option = e.target;
                const index = Array.from(select.options).indexOf(option);

                // Shift + klik = zaznacz zakres
                if (e.shiftKey && lastSelectedIndex !== -1) {
                    const start = Math.min(lastSelectedIndex, index);
                    const end = Math.max(lastSelectedIndex, index);

                    for (let i = start; i <= end; i++) {
                        select.options[i].selected = true;
                    }

                    // Trigger change event
                    select.dispatchEvent(new Event('change'));
                } else {
                    // Normalny klik = toggle
                    option.selected = !option.selected;
                    lastSelectedIndex = index;

                    // Rozpocznij drag
                    isDragging = true;
                    dragStartSelected = option.selected;
                    select.classList.add('dragging');

                    // Trigger change event
                    select.dispatchEvent(new Event('change'));
                }
            }
        });

        // Podczas przeciągania
        select.addEventListener('mouseover', (e) => {
            if (isDragging && e.target.tagName === 'OPTION') {
                e.target.selected = dragStartSelected;
                e.target.classList.add('drag-hover');

                // Trigger change event
                select.dispatchEvent(new Event('change'));
            }
        });

        select.addEventListener('mouseout', (e) => {
            if (e.target.tagName === 'OPTION') {
                e.target.classList.remove('drag-hover');
            }
        });

        // Zakończ drag
        select.addEventListener('mouseup', () => {
            isDragging = false;
            select.classList.remove('dragging');
        });

        // Globalne mouseup (gdy mysz wychodzi poza select)
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                select.classList.remove('dragging');
            }
        });
    });
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

    // Podwójny suwak dla roku produkcji
    setupYearRangeFilter();

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

    // Setup enhanced multi-select (klik=toggle, drag=select, shift=range)
    setupEnhancedMultiSelect();
}

// Główna funkcja wyszukiwania
async function handleSearch() {
    const voivCode = document.getElementById('voivodeshipSelect').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const appendMode = document.getElementById('appendMode').checked;
    
    // Walidacja
    if (!dateFrom || !dateTo) {
        showWarning('⚠️ Wybierz zakres dat!');
        return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
        showError('❌ Data "od" nie może być późniejsza niż data "do"!');
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
    
    // Zapisz filtry przed wyszukiwaniem
    saveFiltersToStorage();

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
            showWarning('⚠️ Nie znaleziono żadnych pojazdów dla wybranych kryteriów.');
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

        // Success notification
        showSuccess(`✅ Pobrano ${appState.allVehicles.length} pojazdów!`);

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
        showError(`❌ Błąd podczas wyszukiwania: ${error.message}`);
        showScreen('welcome');
    }
}

// Wyszukiwanie w jednym województwie
async function searchVoivodeship(code, dateFrom, dateTo, filters, progressCallback = null) {
    const dateFromAPI = formatDateAPI(dateFrom);
    const dateToAPI = formatDateAPI(dateTo);

    // Sprawdź cache przed wykonaniem requestu
    const cacheKey = generateCacheKey({
        type: 'voivodeship',
        code,
        dateFrom: dateFromAPI,
        dateTo: dateToAPI,
        filters
    });

    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
        console.log(`✅ Cache HIT dla województwa ${code}`);
        showInfo(`📦 Załadowano dane z cache dla ${VOIVODESHIPS[code]}`);
        updateLoadingMessage(`Ładowanie z cache: ${VOIVODESHIPS[code]}...`);
        return cachedData;
    }

    console.log(`❌ Cache MISS dla województwa ${code} - pobieranie z API`);
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
            const response = await fetchWithTimeout(`${CONFIG.API_URL}/pojazdy?${params}`);
            const data = await response.json();

            // Sprawdź czy API zwróciło błąd
            if (data.errors && data.errors.length > 0) {
                const apiError = data.errors[0];
                console.error('❌ API CEPiK error:', apiError);
                throw new Error(`API CEPiK: ${apiError['error-result'] || apiError['error-reason'] || 'Unknown error'} (${apiError['error-code'] || 'no code'})`);
            }

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
    const filteredVehicles = filterByYear(vehicles, filters.yearFrom, filters.yearTo);

    // Zapisz do cache przed zwróceniem
    await setCachedData(cacheKey, filteredVehicles);
    console.log(`💾 Zapisano do cache dla województwa ${code} (${filteredVehicles.length} pojazdów)`);

    return filteredVehicles;
}

// ===========================
// REQUEST QUEUE OPTIMIZATION
// ===========================

// Helper function: sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch z timeoutem i lepszą obsługą błędów
async function fetchWithTimeout(url, options = {}, timeout = CONFIG.TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // Specjalna obsługa rate limit
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 30000;
                throw new Error(`HTTP 429: Rate limit exceeded. Retry after ${waitTime}ms`);
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }

        throw error;
    }
}

/**
 * Tworzy kolejkę requestów z rolling processing
 * - Utrzymuje stałą liczbę równoległych requestów
 * - Wysyła nowy request natychmiast po zakończeniu poprzedniego
 * - Retry logic z exponential backoff
 * - Request deduplication
 * - Real-time progress monitoring
 */
function createRequestQueue(maxConcurrent = 5, progressCallback = null) {
    const queue = [];
    const inProgress = new Set();
    const completed = new Set();
    const failed = new Map();
    let activeCount = 0;
    let totalTasks = 0;

    function notifyProgress() {
        if (progressCallback) {
            progressCallback({
                queued: queue.length,
                active: activeCount,
                completed: completed.size,
                failed: failed.size,
                total: totalTasks,
                percentComplete: totalTasks > 0 ? Math.round((completed.size / totalTasks) * 100) : 0
            });
        }
    }

    async function processNext() {
        // Jeśli brak zadań lub max concurrent osiągnięty
        if (queue.length === 0 || activeCount >= maxConcurrent) {
            return;
        }

        // Pobierz następne zadanie
        const task = queue.shift();
        if (!task) return;

        // Sprawdź deduplikację
        if (completed.has(task.id) || inProgress.has(task.id)) {
            console.log(`⚠️ Skipping duplicate request: ${task.id}`);
            processNext(); // Spróbuj kolejne
            return;
        }

        activeCount++;
        inProgress.add(task.id);
        notifyProgress();

        try {
            console.log(`▶️ Starting request ${task.id} (${activeCount}/${maxConcurrent} active, ${queue.length} queued)`);

            const result = await executeWithRetry(task.fn, task.maxRetries || 3, task.id);

            completed.add(task.id);
            inProgress.delete(task.id);
            activeCount--;
            notifyProgress();

            console.log(`✅ Completed request ${task.id} (${activeCount}/${maxConcurrent} active, ${queue.length} queued)`);

            if (task.onSuccess) {
                task.onSuccess(result);
            }

        } catch (error) {
            inProgress.delete(task.id);
            activeCount--;
            failed.set(task.id, error);
            notifyProgress();

            console.error(`❌ Failed request ${task.id}:`, error.message);

            if (task.onError) {
                task.onError(error);
            }
        }

        // Natychmiast rozpocznij kolejne zadanie
        processNext();
    }

    async function executeWithRetry(fn, maxRetries, taskId) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Nie retry dla 4xx errors (oprócz 429)
                if (error.message.includes('HTTP 4') && !error.message.includes('429')) {
                    console.error(`❌ Client error (no retry): ${error.message}`);
                    throw error;
                }

                // Exponential backoff
                if (attempt < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s
                    console.warn(`⚠️ Retry ${attempt}/${maxRetries} for ${taskId} after ${delay}ms: ${error.message}`);
                    await sleep(delay);
                } else {
                    console.error(`❌ Max retries reached for ${taskId}`);
                }
            }
        }

        throw lastError;
    }

    return {
        add: (task) => {
            queue.push(task);
            totalTasks++;
            notifyProgress();
            processNext();
        },

        start: () => {
            // Wystartuj max concurrent requestów
            notifyProgress();
            for (let i = 0; i < maxConcurrent; i++) {
                processNext();
            }
        },

        waitForAll: () => {
            return new Promise((resolve) => {
                const check = () => {
                    if (activeCount === 0 && queue.length === 0) {
                        resolve({
                            completed: completed.size,
                            failed: failed.size,
                            errors: Array.from(failed.entries())
                        });
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        },

        getStats: () => ({
            queued: queue.length,
            active: activeCount,
            completed: completed.size,
            failed: failed.size
        })
    };
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

// Wyszukiwanie we wszystkich województwach równolegle z trackingiem (OPTIMIZED)
async function searchAllVoivodeships(dateFrom, dateTo, filters) {
    const dateFromAPI = formatDateAPI(dateFrom);
    const dateToAPI = formatDateAPI(dateTo);

    // Sprawdź cache dla zapytania "ALL"
    const cacheKey = generateCacheKey({
        type: 'all-voivodeships',
        dateFrom: dateFromAPI,
        dateTo: dateToAPI,
        filters
    });

    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
        console.log(`✅ Cache HIT dla WSZYSTKICH województw`);
        showInfo(`📦 Załadowano dane z cache dla wszystkich województw`);
        updateLoadingMessage(`Ładowanie z cache: wszystkie województwa...`);
        return cachedData;
    }

    console.log(`❌ Cache MISS dla WSZYSTKICH województw - pobieranie z API`);

    const codes = Object.keys(VOIVODESHIPS);
    const allVehicles = [];
    const seenIds = new Set();

    updateLoadingMessage(`Odpytywanie ${codes.length} województw równolegle (optimized)...`);

    // Inicjalizuj statusy
    initVoivodeshipStatuses();

    // Utwórz request queue z rolling processing i progress monitoring
    const queue = createRequestQueue(CONFIG.MAX_CONCURRENT_REQUESTS, (progress) => {
        // Real-time progress update
        updateProgress(progress.completed, progress.total);
        console.log(`📊 Progress: ${progress.percentComplete}% (${progress.completed}/${progress.total}) | Active: ${progress.active} | Queued: ${progress.queued}`);
    });

    console.log(`🚀 Starting optimized request queue with ${CONFIG.MAX_CONCURRENT_REQUESTS} concurrent requests`);

    // Dodaj wszystkie województwa do kolejki
    codes.forEach(code => {
        queue.add({
            id: `voivodeship-${code}`,
            maxRetries: 3,
            fn: async () => {
                return await searchVoivodeshipWithTracking(code, dateFrom, dateTo, filters);
            },
            onSuccess: (vehicles) => {
                // Dodaj wyniki z deduplicacją
                vehicles.forEach(vehicle => {
                    const id = vehicle.id;
                    if (!seenIds.has(id)) {
                        seenIds.add(id);
                        allVehicles.push(vehicle);
                    }
                });
            },
            onError: (error) => {
                console.error(`❌ Failed to fetch ${VOIVODESHIPS[code]}:`, error);
                appState.voivodeshipStatuses[code].status = '❌ Błąd';
                appState.voivodeshipStatuses[code].error = error.message;
                updateVoivodeshipStatusTable();
            }
        });
    });

    // Wystartuj przetwarzanie
    queue.start();

    // Czekaj na zakończenie wszystkich requestów
    const stats = await queue.waitForAll();

    console.log(`✅ Request queue completed:`, stats);
    console.log(`📊 Total vehicles: ${allVehicles.length} (deduplicated from ${seenIds.size} unique IDs)`);

    // Zapisz do cache przed zwróceniem
    await setCachedData(cacheKey, allVehicles);
    console.log(`💾 Zapisano do cache dla WSZYSTKICH województw (${allVehicles.length} pojazdów)`);

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

    // Filtr roku (pola od-do)
    const yearMinInput = document.getElementById('filterYearMinInput');
    const yearMaxInput = document.getElementById('filterYearMaxInput');
    if (yearMinInput && yearMaxInput) {
        const minYear = yearMinInput.value ? parseInt(yearMinInput.value) : parseInt(yearMinInput.min);
        const maxYear = yearMaxInput.value ? parseInt(yearMaxInput.value) : parseInt(yearMaxInput.max);

        filtered = filtered.filter(v => {
            const year = parseInt(v.attributes?.['rok-produkcji']);
            return !isNaN(year) && year >= minYear && year <= maxYear;
        });
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

    // Reset pól roku
    const yearMinInput = document.getElementById('filterYearMinInput');
    const yearMaxInput = document.getElementById('filterYearMaxInput');

    if (yearMinInput && yearMaxInput) {
        yearMinInput.value = '';
        yearMaxInput.value = '';
    }

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

    console.log('🔍 updateDynamicFilters wywołane, wybrano kolumny:', selectedColumns);

    // Wyczyść dynamiczne filtry
    appState.dynamicFilters = {};
    container.innerHTML = '';

    if (selectedColumns.length === 0) {
        console.log('ℹ️ Brak wybranych kolumn, czyszczenie filtrów');
        applyFilters();
        return;
    }

    console.log(`📋 Generowanie ${selectedColumns.length} dynamicznych filtrów...`);

    // Dla każdej wybranej kolumny stwórz odpowiedni filtr
    selectedColumns.forEach((column, idx) => {
        const col = document.createElement('div');
        col.className = 'col-md-6';

        // Sprawdź typ kolumny
        const values = appState.allVehicles.map(v => v.attributes?.[column]).filter(Boolean);
        const uniqueValues = [...new Set(values)];
        const isNumeric = values.every(v => !isNaN(parseFloat(v)));

        if (isNumeric && uniqueValues.length > 20) {
            // Numeryczny filtr (pola od-do)
            const numericValues = values.map(v => parseFloat(v));
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);

            col.innerHTML = `
                <label class="form-label"><strong>🔢 ${column}</strong></label>
                <div class="row g-2">
                    <div class="col-6">
                        <label class="form-label small">Od:</label>
                        <input type="number" class="form-control form-control-sm"
                            id="dynamicFilterMinInput_${idx}"
                            placeholder="${min.toFixed(0)}"
                            min="${min}"
                            max="${max}"
                            step="1">
                    </div>
                    <div class="col-6">
                        <label class="form-label small">Do:</label>
                        <input type="number" class="form-control form-control-sm"
                            id="dynamicFilterMaxInput_${idx}"
                            placeholder="${max.toFixed(0)}"
                            min="${min}"
                            max="${max}"
                            step="1">
                    </div>
                </div>
                <small class="text-muted">Zakres: ${min.toFixed(0)} - ${max.toFixed(0)}</small>
            `;

            container.appendChild(col);

            // Event listeners
            setTimeout(() => {
                const minInput = document.getElementById(`dynamicFilterMinInput_${idx}`);
                const maxInput = document.getElementById(`dynamicFilterMaxInput_${idx}`);

                const updateFilter = () => {
                    const minVal = minInput.value ? parseFloat(minInput.value) : min;
                    const maxVal = maxInput.value ? parseFloat(maxInput.value) : max;

                    appState.dynamicFilters[column] = {
                        min: minVal,
                        max: maxVal
                    };
                    applyFilters();
                };

                minInput.addEventListener('change', updateFilter);
                maxInput.addEventListener('change', updateFilter);
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

    // Aktualizuj pola roku
    const yearMinInput = document.getElementById('filterYearMinInput');
    const yearMaxInput = document.getElementById('filterYearMaxInput');

    if (yearMinInput && yearMaxInput) {
        // Ustaw nowe min/max
        yearMinInput.min = minYear;
        yearMinInput.max = maxYear;
        yearMaxInput.min = minYear;
        yearMaxInput.max = maxYear;

        // Ustaw placeholder
        yearMinInput.placeholder = minYear;
        yearMaxInput.placeholder = maxYear;

        // Aktualizuj etykiety zakresu
        document.getElementById('filterYearMin').textContent = minYear;
        document.getElementById('filterYearMax').textContent = maxYear;
    }

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

    // Re-inicjalizuj enhanced multi-select dla nowo dodanych opcji
    setupEnhancedMultiSelect();
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
        // Obsługa kolumny 'id' (vehicle.id zamiast attributes)
        let valA = column === 'id' ? a.id : a.attributes?.[column];
        let valB = column === 'id' ? b.id : b.attributes?.[column];

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

    // Dodaj kolumnę ID pojazdu
    const idTh = document.createElement('th');
    idTh.textContent = 'ID pojazdu';
    idTh.className = 'sortable';
    idTh.dataset.column = 'id';
    idTh.innerHTML = `ID pojazdu <i class="bi bi-arrow-down-up"></i>`;
    idTh.addEventListener('click', () => handleSort('id'));
    headerRow.appendChild(idTh);

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

        // Dodaj kolumnę ID pojazdu jako link
        const idCell = row.insertCell();
        const idLink = document.createElement('a');
        idLink.href = `https://api.cepik.gov.pl/pojazdy/${vehicle.id}`;
        idLink.target = '_blank';
        idLink.textContent = vehicle.id;
        idLink.className = 'text-primary';
        idLink.title = 'Otwórz szczegóły pojazdu w nowej karcie';
        idCell.appendChild(idLink);

        columns.forEach(col => {
            const value = attrs[col] || '-';
            // Mapuj kody województw na nazwy
            const displayValue = col === 'wojewodztwo' || col === 'wojewodztwo-kod' ?
                mapVoivodeshipValue(value) : value;
            row.insertCell().textContent = displayValue;
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

    // Wszystkie dostępne kolumny
    const availableColumns = appState.availableColumns || [];
    if (availableColumns.length === 0) {
        console.warn('Brak dostępnych kolumn do wizualizacji');
        return;
    }

    // Losowy typ wykresu
    const chartTypes = ['bar', 'pie', 'histogram', 'scatter', 'box'];
    const randomChartType = chartTypes[Math.floor(Math.random() * chartTypes.length)];

    // Rozróżnij kolumny kategoryczne i numeryczne
    const categoricalColumns = [];
    const numericalColumns = [];

    availableColumns.forEach(col => {
        // Sprawdź pierwszy pojazd aby określić typ kolumny
        const sampleValue = appState.allVehicles[0]?.attributes?.[col];
        if (sampleValue !== undefined && sampleValue !== null) {
            const num = parseFloat(sampleValue);
            if (!isNaN(num)) {
                numericalColumns.push(col);
            } else {
                categoricalColumns.push(col);
            }
        }
    });

    console.log(`Losowy typ wykresu: ${randomChartType}`);

    // Wybierz kolumny w zależności od typu wykresu
    let columnX = null;
    let columnY = null;

    if (randomChartType === 'bar' || randomChartType === 'pie') {
        // Bar i Pie - kolumny kategoryczne
        if (categoricalColumns.length > 0) {
            columnX = categoricalColumns[Math.floor(Math.random() * categoricalColumns.length)];
        } else {
            // Fallback do jakiejkolwiek kolumny
            columnX = availableColumns[Math.floor(Math.random() * availableColumns.length)];
        }
    } else if (randomChartType === 'histogram') {
        // Histogram - kolumny numeryczne
        if (numericalColumns.length > 0) {
            columnX = numericalColumns[Math.floor(Math.random() * numericalColumns.length)];
        } else {
            // Fallback do pierwszej dostępnej
            columnX = availableColumns[0];
        }
    } else if (randomChartType === 'scatter') {
        // Scatter - 2 kolumny numeryczne
        if (numericalColumns.length >= 2) {
            // Losuj 2 różne kolumny numeryczne
            const shuffled = [...numericalColumns].sort(() => 0.5 - Math.random());
            columnX = shuffled[0];
            columnY = shuffled[1];
        } else if (numericalColumns.length === 1) {
            columnX = numericalColumns[0];
            columnY = availableColumns.find(c => c !== columnX) || availableColumns[0];
        } else {
            // Fallback do losowych kolumn
            const shuffled = [...availableColumns].sort(() => 0.5 - Math.random());
            columnX = shuffled[0];
            columnY = shuffled[1] || shuffled[0];
        }
    } else if (randomChartType === 'box') {
        // Box - kolumna kategoryczna (X) i numeryczna (Y)
        if (categoricalColumns.length > 0 && numericalColumns.length > 0) {
            columnX = categoricalColumns[Math.floor(Math.random() * categoricalColumns.length)];
            columnY = numericalColumns[Math.floor(Math.random() * numericalColumns.length)];
        } else if (categoricalColumns.length > 0) {
            columnX = categoricalColumns[Math.floor(Math.random() * categoricalColumns.length)];
            columnY = availableColumns.find(c => c !== columnX) || availableColumns[0];
        } else {
            // Fallback
            const shuffled = [...availableColumns].sort(() => 0.5 - Math.random());
            columnX = shuffled[0];
            columnY = shuffled[1] || shuffled[0];
        }
    }

    if (!columnX) {
        console.warn('Nie można wybrać kolumny do wizualizacji');
        return;
    }

    console.log(`Wybrano kolumny: X=${columnX}, Y=${columnY || 'brak'}`);

    // Ustaw parametry wykresu
    document.getElementById('chartType').value = randomChartType;
    document.getElementById('chartColumn').value = columnX;

    if (columnY && document.getElementById('chartColumnY')) {
        document.getElementById('chartColumnY').value = columnY;
    }

    // Aktualizuj widoczność pól w zależności od typu wykresu
    updateChartTypeOptions();

    // Wygeneruj wykres
    try {
        generateChart();
        console.log(`Wykres wygenerowany pomyślnie: ${randomChartType} | X: ${columnX} | Y: ${columnY || 'brak'}`);
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
        showError('Brak danych do wizualizacji! Spróbuj zresetować filtry.');
        return;
    }

    // Sprawdź czy mamy wiele batchy (dla kolorowania)
    const batchIds = [...new Set(data.map(v => v._batch_id))].filter(Boolean);
    const hasBatches = batchIds.length > 1;

    const container = document.getElementById('chartContainer');

    if (chartType === 'bar') {
        const values = data.map(v => {
            const val = v.attributes?.[column];
            // Mapuj kody województw
            return column.includes('wojewodztwo') ? mapVoivodeshipValue(val) : val;
        }).filter(Boolean);

        if (values.length === 0) {
            showError('Brak danych dla wybranej kolumny!');
            return;
        }

        if (hasBatches) {
            // Grupuj po kolumnie i batch_id
            const traces = [];
            batchIds.forEach(batchId => {
                const batchData = data.filter(v => v._batch_id === batchId);
                const counts = {};
                batchData.forEach(v => {
                    let val = v.attributes?.[column];
                    // Mapuj kody województw
                    if (column.includes('wojewodztwo')) {
                        val = mapVoivodeshipValue(val);
                    }
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
        const values = data.map(v => {
            const val = v.attributes?.[column];
            // Mapuj kody województw
            return column.includes('wojewodztwo') ? mapVoivodeshipValue(val) : val;
        }).filter(Boolean);

        if (values.length === 0) {
            showError('Brak danych dla wybranej kolumny!');
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
            showError('Kolumna nie zawiera wartości numerycznych!');
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
            showError('Brak danych numerycznych dla wybranych kolumn!');
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
            showError('Brak odpowiednich danych dla Box Plot!');
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
        showError('Brak danych do eksportu!');
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
        showError('Brak danych do eksportu!');
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

