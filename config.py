"""
Plik konfiguracyjny dla aplikacji CEPiK
"""
import os
from dotenv import load_dotenv

# Wczytanie zmiennych środowiskowych z pliku .env
load_dotenv()

# Konfiguracja API
CEPIK_API_URL = os.getenv("CEPIK_API_URL", "https://api.cepik.gov.pl")

# Konfiguracja Streamlit
STREAMLIT_SERVER_PORT = int(os.getenv("STREAMLIT_SERVER_PORT", 8501))
STREAMLIT_SERVER_ADDRESS = os.getenv("STREAMLIT_SERVER_ADDRESS", "localhost")

# Ustawienia aplikacji
DEFAULT_LIMIT = 500
DEFAULT_PAGE = 1

# Zakres lat
MIN_YEAR = 1900
MAX_YEAR = 2030

# Lista województw (fallback)
VOIVODESHIPS = [
    "dolnośląskie",
    "kujawsko-pomorskie",
    "lubelskie",
    "lubuskie",
    "łódzkie",
    "małopolskie",
    "mazowieckie",
    "opolskie",
    "podkarpackie",
    "podlaskie",
    "pomorskie",
    "śląskie",
    "świętokrzyskie",
    "warmińsko-mazurskie",
    "wielkopolskie",
    "zachodniopomorskie"
]


