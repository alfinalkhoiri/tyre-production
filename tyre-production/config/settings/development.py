from .base import *  # noqa: F401, F403

DEBUG = True

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     config('DB_NAME',     default='tyre_production'),
        'USER':     config('DB_USER',     default='tyre_user'),
        'PASSWORD': config('DB_PASSWORD', default='tyre_pass_2025'),
        'HOST':     config('DB_HOST',     default='localhost'),
        'PORT':     config('DB_PORT',     default='5432'),
    }
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
]
CORS_ALLOW_CREDENTIALS = True

# Disable throttling in development for easier testing
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []  # noqa: F405
