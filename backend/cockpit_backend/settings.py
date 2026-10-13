"""
Django settings for cockpit_backend project.
Suporta Microsoft SQL Server (On-Premises) com fallback para SQLite em desenvolvimento local.
"""

from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

# Carrega variáveis de ambiente do .env na raiz do projeto ou em backend/
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "cockpit-pivos-dev-secret-key-agtech-2026")
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

if not DEBUG and (not SECRET_KEY or SECRET_KEY == "cockpit-pivos-dev-secret-key-agtech-2026"):
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured("Em ambientes de produção (DEBUG=False), uma SECRET_KEY segura e exclusiva deve ser configurada via variável de ambiente.")

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS if host.strip()]

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    
    # Third party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "drf_spectacular",
    
    # Local Apps
    "apps.core",
    "apps.pivots",
    "apps.operations",
    "apps.sync",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "cockpit_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "cockpit_backend.wsgi.application"
ASGI_APPLICATION = "cockpit_backend.asgi.application"

from django.core.exceptions import ImproperlyConfigured

# -----------------------------------------------------------------------------
# BANCO DE DADOS: Microsoft SQL Server ou SQLite Local
# -----------------------------------------------------------------------------
DB_ENGINE_CHOICE = os.getenv("DB_ENGINE", "sqlite").lower()

if DB_ENGINE_CHOICE == "mssql":
    # Utiliza conexão nativa estrita com Microsoft SQL Server sem fallback silencioso
    DATABASES = {
        "default": {
            "ENGINE": "mssql",
            "NAME": os.getenv("DB_NAME", "CockpitPivosDB"),
            "USER": os.getenv("DB_USER", "sa_cockpit"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "1433"),
            "OPTIONS": {
                "driver": os.getenv("DB_ODBC_DRIVER", "ODBC Driver 18 for SQL Server"),
                "extra_params": f"TrustServerCertificate={os.getenv('DB_TRUST_SERVER_CERTIFICATE', 'yes')}",
            },
        }
    }
elif DB_ENGINE_CHOICE == "sqlite":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise ImproperlyConfigured(f"DB_ENGINE '{DB_ENGINE_CHOICE}' não suportado. Utilize 'mssql' ou 'sqlite'.")

if not DEBUG and SECRET_KEY == "cockpit-pivos-dev-secret-key-agtech-2026":
    raise ImproperlyConfigured("SECRET_KEY de desenvolvimento não permitida em produção.")

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internationalization
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# -----------------------------------------------------------------------------
# REST FRAMEWORK & OPENAPI
# Permissões seguras por padrão: requer autenticação para todos os endpoints.
# -----------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%SZ",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Cockpit de Pivôs — API Central",
    "DESCRIPTION": "API de gestão agrícola, planejamento de safras, telemetria de pivôs centrais e sincronização offline mobile.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# -----------------------------------------------------------------------------
# CORS SETTINGS
# -----------------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
