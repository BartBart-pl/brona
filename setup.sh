#!/bin/bash

# Skrypt instalacyjny dla aplikacji CEPiK

echo "🚗 Instalacja aplikacji CEPiK..."

# Sprawdzenie czy Python jest zainstalowany
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 nie jest zainstalowany. Zainstaluj Python 3.7 lub nowszy."
    exit 1
fi

echo "✅ Python3 znaleziony: $(python3 --version)"

# Tworzenie wirtualnego środowiska
echo "📦 Tworzenie wirtualnego środowiska..."
python3 -m venv env

# Aktywacja wirtualnego środowiska
echo "🔧 Aktywacja wirtualnego środowiska..."
source env/bin/activate

# Instalacja zależności
echo "📥 Instalacja zależności..."
pip install --upgrade pip
pip install -r requirements.txt

# Kopiowanie pliku konfiguracyjnego
if [ ! -f .env ]; then
    echo "📄 Tworzenie pliku .env..."
    cp .env.example .env
fi

echo ""
echo "✅ Instalacja zakończona pomyślnie!"
echo ""
echo "Aby uruchomić aplikację:"
echo "  1. Aktywuj środowisko: source env/bin/activate"
echo "  2. Uruchom aplikację: streamlit run app.py"
echo ""


