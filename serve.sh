#!/bin/bash
# Skrypt do uruchamiania serwera HTTP dla aplikacji BRONA

PORT=${1:-8000}

echo "🚀 Uruchamianie serwera BRONA na porcie $PORT..."
python3 serve.py $PORT

