#!/usr/bin/env python3
"""
Prosty serwer HTTP do serwowania statycznej aplikacji BRONA
Użycie: python3 serve.py [port]
Domyślny port: 8000
"""

import http.server
import socketserver
import sys
import os

# Zmień katalog na katalog ze skryptem
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Port z argumentu lub domyślnie 8000
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# Handler z obsługą CORS (dla testów z API)
class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Dodaj nagłówki CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Cache-Control dla lepszej wydajności
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

# Wyłącz buforowanie dla development
Handler = CORSRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"╔══════════════════════════════════════════════════════════╗")
    print(f"║  BRONA - Serwer HTTP                                     ║")
    print(f"╠══════════════════════════════════════════════════════════╣")
    print(f"║  🌐 Serwer działa na:                                    ║")
    print(f"║     http://localhost:{PORT}                                ║")
    print(f"║     http://127.0.0.1:{PORT}                                ║")
    print(f"║                                                          ║")
    print(f"║  📁 Serwuje pliki z: {os.getcwd():<27}║")
    print(f"║                                                          ║")
    print(f"║  ✅ Aplikacja gotowa do użycia!                          ║")
    print(f"║  🔄 Odśwież przeglądarkę jeśli już ją otworzyłeś         ║")
    print(f"║                                                          ║")
    print(f"║  ⚠️  WAŻNE:                                              ║")
    print(f"║  • Wszystkie zapytania do API wykonywane są              ║")
    print(f"║    bezpośrednio z przeglądarki użytkownika               ║")
    print(f"║  • Serwer tylko serwuje statyczne pliki HTML/JS/CSS      ║")
    print(f"║  • Brak obciążenia serwera przy wielu użytkownikach      ║")
    print(f"║                                                          ║")
    print(f"║  Naciśnij Ctrl+C aby zatrzymać serwer                    ║")
    print(f"╚══════════════════════════════════════════════════════════╝")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Zatrzymywanie serwera...")
        httpd.shutdown()
        print("✅ Serwer zatrzymany")

