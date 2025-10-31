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
    API_URL: 'https://wispy-sunset-6278.bartlomiej-bartczak.workers.dev/',

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
    batchCounter: 0
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
        const response = await fetch(`${CONFIG.API_URL}/slowniki?limit=100&page=1`);
        const data = await response.json();
        
        if (data.data && Array.isArray(data.data)) {
            // Pobierz wartości dla interesujących nas słowników
            const dictionariesToLoad = ['marka', 'rodzaj-pojazdu', 'rodzaj-paliwa'];
            
            for (const dictItem of data.data) {
                const dictId = dictItem.id;
                if (dictionariesToLoad.includes(dictId)) {
                    const values = await loadDictionary(dictId);
                    if (values.length > 0) {
                        appState.dictionaries[dictId] = values;
                        populateFilterSelect(dictId, values);
                    }
                }
            }
        }
        
        console.log('Słowniki załadowane:', appState.dictionaries);
    } catch (error) {
        console.error('Błąd ładowania słowników:', error);
        // Aplikacja będzie działać bez słowników - używając wartości z danych
    }
}

// Ładowanie pojedynczego słownika
async function loadDictionary(dictionaryName) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/slowniki/${dictionaryName}`);
        const data = await response.json();
        
        if (data.data && data.data.attributes && data.data.attributes['dostepne-rekordy-slownika']) {
            const records = data.data.attributes['dostepne-rekordy-slownika'];
            return records
                .map(r => r['klucz-slownika'])
                .filter(v => v && !v.match(/^\d+$/)); // Usuń wartości czysto liczbowe
        }
        return [];
    } catch (error) {
        console.error(`Błąd ładowania słownika ${dictionaryName}:`, error);
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
        
        // Dodaj batch ID
        appState.batchCounter++;
        newVehicles.forEach(v => v._batch_id = appState.batchCounter);
        
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
        
        // Zastosuj filtry i pokaż wyniki
        applyFilters();
        showScreen('results');
        document.getElementById('clearBtn').style.display = 'block';
        
        // Pokaż info
        updateSearchInfo();
        
    } catch (error) {
        console.error('Błąd wyszukiwania:', error);
        alert(`Błąd podczas wyszukiwania: ${error.message}`);
        showScreen('welcome');
    }
}

// Wyszukiwanie w jednym województwie
async function searchVoivodeship(code, dateFrom, dateTo, filters) {
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

// Wyszukiwanie we wszystkich województwach równolegle
async function searchAllVoivodeships(dateFrom, dateTo, filters) {
    const codes = Object.keys(VOIVODESHIPS);
    const allVehicles = [];
    const seenIds = new Set();
    
    updateLoadingMessage(`Odpytywanie ${codes.length} województw równolegle...`);
    
    // Wykonaj zapytania w partiach (max 5 jednocześnie)
    for (let i = 0; i < codes.length; i += CONFIG.MAX_CONCURRENT_REQUESTS) {
        const batch = codes.slice(i, i + CONFIG.MAX_CONCURRENT_REQUESTS);
        
        const promises = batch.map(code => 
            searchVoivodeship(code, dateFrom, dateTo, filters)
                .catch(error => {
                    console.error(`Błąd dla ${VOIVODESHIPS[code]}:`, error);
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
        
        updateProgress(allVehicles.length, allVehicles.length);
    }
    
    return allVehicles;
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
}

// Zastosowanie filtrów
function applyFilters() {
    let filtered = [...appState.allVehicles];
    
    // Filtr marki
    const selectedBrands = Array.from(document.getElementById('filterBrand').selectedOptions).map(o => o.value);
    if (selectedBrands.length > 0) {
        filtered = filtered.filter(v => selectedBrands.includes(v.attributes?.marka));
    }
    
    // Filtr rodzaju pojazdu
    const selectedTypes = Array.from(document.getElementById('filterVehicleType').selectedOptions).map(o => o.value);
    if (selectedTypes.length > 0) {
        filtered = filtered.filter(v => selectedTypes.includes(v.attributes?.['rodzaj-pojazdu']));
    }
    
    // Filtr paliwa
    const selectedFuels = Array.from(document.getElementById('filterFuelType').selectedOptions).map(o => o.value);
    if (selectedFuels.length > 0) {
        filtered = filtered.filter(v => selectedFuels.includes(v.attributes?.['rodzaj-paliwa']));
    }
    
    // Filtr roku
    const maxYear = parseInt(document.getElementById('filterYearRange').value);
    const minYear = parseInt(document.getElementById('filterYearRange').min);
    if (maxYear < parseInt(document.getElementById('filterYearRange').max)) {
        filtered = filtered.filter(v => {
            const year = parseInt(v.attributes?.['rok-produkcji']);
            return year >= minYear && year <= maxYear;
        });
    }
    
    appState.filteredVehicles = filtered;
    appState.currentPage = 1;
    
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
    applyFilters();
}

// Aktualizacja opcji filtrów (na podstawie danych)
function updateFilterOptions() {
    const vehicles = appState.allVehicles;
    
    // Zbierz unikalne wartości
    const brands = new Set();
    const types = new Set();
    const fuels = new Set();
    let minYear = 9999, maxYear = 0;
    
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
    const tbody = document.getElementById('vehiclesTableBody');
    const pageSize = parseInt(document.getElementById('pageSize').value);
    const start = (appState.currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = appState.filteredVehicles.slice(start, end);
    
    tbody.innerHTML = '';
    
    pageData.forEach((vehicle, idx) => {
        const attrs = vehicle.attributes || {};
        const row = tbody.insertRow();
        
        row.insertCell().textContent = start + idx + 1;
        row.insertCell().textContent = attrs.marka || '-';
        row.insertCell().textContent = attrs.model || '-';
        row.insertCell().textContent = attrs['rok-produkcji'] || '-';
        row.insertCell().textContent = attrs['rodzaj-pojazdu'] || '-';
        row.insertCell().textContent = attrs['rodzaj-paliwa'] || '-';
        row.insertCell().textContent = attrs['pojemnosc-skokowa-silnika'] || '-';
        row.insertCell().textContent = attrs['masa-wlasna'] || '-';
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

// Generowanie wykresów
function generateChart() {
    const chartType = document.getElementById('chartType').value;
    const column = document.getElementById('chartColumn').value;
    const topN = parseInt(document.getElementById('chartTopN').value);
    
    const data = appState.filteredVehicles;
    
    if (data.length === 0) {
        alert('Brak danych do wizualizacji!');
        return;
    }
    
    // Zbierz wartości
    const values = data.map(v => v.attributes?.[column]).filter(Boolean);
    
    if (values.length === 0) {
        alert('Brak danych dla wybranej kolumny!');
        return;
    }
    
    // Policz częstości
    const counts = {};
    values.forEach(v => {
        counts[v] = (counts[v] || 0) + 1;
    });
    
    // Sortuj i weź top N
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, topN);
    
    const labels = top.map(([label]) => label);
    const data_values = top.map(([, count]) => count);
    
    // Generuj wykres
    const container = document.getElementById('chartContainer');
    
    if (chartType === 'bar') {
        const trace = {
            x: data_values,
            y: labels,
            type: 'bar',
            orientation: 'h',
            marker: {
                color: 'rgb(55, 83, 109)'
            }
        };
        const layout = {
            title: `Top ${topN}: ${column}`,
            xaxis: { title: 'Liczba' },
            yaxis: { title: column },
            height: 500
        };
        Plotly.newPlot(container, [trace], layout);
        
    } else if (chartType === 'pie') {
        const trace = {
            labels: labels,
            values: data_values,
            type: 'pie'
        };
        const layout = {
            title: `Rozkład: ${column}`,
            height: 500
        };
        Plotly.newPlot(container, [trace], layout);
        
    } else if (chartType === 'histogram') {
        // Dla histogramu używamy wszystkich wartości (nie top N)
        const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
        
        if (numericValues.length === 0) {
            alert('Kolumna nie zawiera wartości numerycznych!');
            return;
        }
        
        const trace = {
            x: numericValues,
            type: 'histogram',
            marker: {
                color: 'rgb(55, 83, 109)'
            }
        };
        const layout = {
            title: `Histogram: ${column}`,
            xaxis: { title: column },
            yaxis: { title: 'Liczba' },
            height: 500
        };
        Plotly.newPlot(container, [trace], layout);
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

