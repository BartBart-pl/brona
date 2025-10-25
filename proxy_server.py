#!/usr/bin/env python3
"""
Proxy Server dla BRONA - rozwiązuje problem CORS z API CEPiK

Ten serwer pośredniczy między aplikacją frontendową a API CEPiK,
dodając odpowiednie nagłówki CORS do odpowiedzi.
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import ssl
from urllib.error import HTTPError, URLError

class CORSRequestHandler(SimpleHTTPRequestHandler):
    """Handler HTTP z obsługą CORS i proxy do API CEPiK"""
    
    def end_headers(self):
        # Dodaj nagłówki CORS do każdej odpowiedzi
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        SimpleHTTPRequestHandler.end_headers(self)
    
    def do_OPTIONS(self):
        """Obsługa preflight CORS request"""
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        """Obsługa GET - proxy dla API lub serwowanie plików statycznych"""
        
        # Sprawdź czy to zapytanie do API
        if self.path.startswith('/api/'):
            self.proxy_api_request()
        else:
            # Normalne serwowanie plików statycznych
            super().do_GET()
    
    def proxy_api_request(self):
        """Przekaż zapytanie do API CEPiK i zwróć odpowiedź"""
        try:
            # Usuń prefix /api/ i stwórz pełny URL do API CEPiK
            api_path = self.path[5:]  # Usuń '/api/'
            api_url = f'https://api.cepik.gov.pl{api_path}'
            
            print(f"Proxy: {self.path} -> {api_url}")
            
            # Stwórz SSL context z niższym poziomem bezpieczeństwa
            # (API CEPiK używa starszych certyfikatów)
            ssl_context = ssl.create_default_context()
            ssl_context.set_ciphers('DEFAULT@SECLEVEL=1')
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            
            # Wykonaj zapytanie do API CEPiK
            req = urllib.request.Request(
                api_url,
                headers={
                    'Accept': 'application/json',
                    'User-Agent': 'BRONA/3.0'
                }
            )
            
            with urllib.request.urlopen(req, context=ssl_context, timeout=30) as response:
                data = response.read()
                
                # Wyślij odpowiedź
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(data)
                
        except HTTPError as e:
            print(f"HTTP Error: {e.code} - {e.reason}")
            self.send_error(e.code, f"API Error: {e.reason}")
            
        except URLError as e:
            print(f"URL Error: {e.reason}")
            self.send_error(502, f"Connection Error: {e.reason}")
            
        except Exception as e:
            print(f"Error: {type(e).__name__}: {str(e)}")
            self.send_error(500, f"Server Error: {str(e)}")
    
    def log_message(self, format, *args):
        """Logowanie requestów"""
        # Tylko loguj proxy requests
        if args[0].startswith('GET /api/'):
            print(f"{self.address_string()} - {format % args}")

def run_server(port=8000):
    """Uruchom serwer proxy"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    
    print("=" * 70)
    print("🚗 BRONA - Proxy Server")
    print("=" * 70)
    print(f"\n✅ Serwer uruchomiony na porcie {port}")
    print(f"\n🌐 Otwórz przeglądarkę:")
    print(f"   http://localhost:{port}")
    print(f"\n📡 Proxy endpoint:")
    print(f"   http://localhost:{port}/api/* -> https://api.cepik.gov.pl/*")
    print("\n⚙️  Naciśnij Ctrl+C aby zatrzymać serwer\n")
    print("=" * 70)
    print()
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 Zatrzymywanie serwera...")
        httpd.shutdown()
        print("✅ Serwer zatrzymany")

if __name__ == '__main__':
    import sys
    
    # Opcjonalnie pozwól na zmianę portu z argumentu
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"❌ Błędny numer portu: {sys.argv[1]}")
            print(f"Użycie: python proxy_server.py [PORT]")
            sys.exit(1)
    
    run_server(port)

