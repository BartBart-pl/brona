#!/bin/bash

# Skrypt do uruchamiania aplikacji CEPiK

echo "🚗 Uruchamianie aplikacji CEPiK..."

# Sprawdzenie czy wirtualne środowisko istnieje
if [ ! -d "env" ]; then
    echo "❌ Wirtualne środowisko nie zostało znalezione."
    echo "   Uruchom najpierw: ./setup.sh"
    exit 1
fi

# Aktywacja wirtualnego środowiska
source env/bin/activate

# Sprawdzenie czy Streamlit jest zainstalowany
if ! command -v streamlit &> /dev/null; then
    echo "❌ Streamlit nie jest zainstalowany."
    echo "   Uruchom: pip install -r requirements.txt"
    exit 1
fi

# Uruchomienie aplikacji
echo "✅ Uruchamianie Streamlit..."
echo ""
streamlit run app.py


