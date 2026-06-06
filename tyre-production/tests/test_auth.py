"""Tests: JWT authentication — login, refresh, logout, me, permissions."""
import pytest
from rest_framework import status
from rest_framework.test import APIClient

from .factories import UserFactory


@pytest.fixture
def client():
    return APIClient()


def _login(client, username='testuser', password='testpass123'):
    user = UserFactory(username=username, password=password)
    res = client.post('/api/auth/login/', {'username': username, 'password': password})
    return user, res


@pytest.mark.django_db
class TestLogin:
    def test_valid_credentials_return_tokens(self, client):
        _, res = _login(client)
        assert res.status_code == status.HTTP_200_OK
        assert 'access' in res.data
        assert 'refresh' in res.data

    def test_invalid_password_rejected(self, client):
        UserFactory(username='badpass')
        res = client.post('/api/auth/login/', {'username': 'badpass', 'password': 'wrongpass'})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unknown_user_rejected(self, client):
        res = client.post('/api/auth/login/', {'username': 'ghost', 'password': 'x'})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_fields_rejected(self, client):
        res = client.post('/api/auth/login/', {'username': 'only'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTokenRefresh:
    def test_valid_refresh_returns_new_access(self, client):
        _, login_res = _login(client)
        res = client.post('/api/auth/token/refresh/', {'refresh': login_res.data['refresh']})
        assert res.status_code == status.HTTP_200_OK
        assert 'access' in res.data

    def test_invalid_refresh_rejected(self, client):
        res = client.post('/api/auth/token/refresh/', {'refresh': 'not.a.token'})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestLogout:
    def test_logout_blacklists_token(self, client):
        _, login_res = _login(client)
        refresh = login_res.data['refresh']
        access  = login_res.data['access']

        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        res = client.post('/api/auth/logout/', {'refresh': refresh})
        assert res.status_code == status.HTTP_200_OK

        # refresh yang sudah di-blacklist tidak bisa dipakai lagi
        res2 = client.post('/api/auth/token/refresh/', {'refresh': refresh})
        assert res2.status_code == status.HTTP_401_UNAUTHORIZED

    def test_logout_requires_auth(self, client):
        res = client.post('/api/auth/logout/', {'refresh': 'x'})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestMeEndpoint:
    def test_me_returns_user_data(self, client):
        user, login_res = _login(client, 'alfin', 'testpass123')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.get('/api/auth/me/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['username'] == 'alfin'
        assert 'password' not in res.data

    def test_me_unauthenticated(self, client):
        res = client.get('/api/auth/me/')
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_me_update_name(self, client):
        _, login_res = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.patch('/api/auth/me/', {'first_name': 'Budi'})
        assert res.status_code == status.HTTP_200_OK
        assert res.data['first_name'] == 'Budi'


@pytest.mark.django_db
class TestChangePassword:
    def test_change_password_success(self, client):
        _, login_res = _login(client, 'cpuser', 'testpass123')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.post('/api/auth/change-password/', {
            'old_password': 'testpass123',
            'new_password': 'newSecure456!',
        })
        assert res.status_code == status.HTTP_200_OK

        # login dengan password baru harus berhasil
        res2 = client.post('/api/auth/login/', {'username': 'cpuser', 'password': 'newSecure456!'})
        assert res2.status_code == status.HTTP_200_OK

    def test_wrong_old_password_rejected(self, client):
        _, login_res = _login(client, 'cpuser2', 'testpass123')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.post('/api/auth/change-password/', {
            'old_password': 'wrongpass',
            'new_password': 'newSecure456!',
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestRegisterPermission:
    def test_register_requires_admin(self, client):
        _, login_res = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.post('/api/auth/register/', {
            'username': 'newuser', 'password': 'pass12345',
        })
        # user biasa (is_staff=False) tidak bisa register user baru
        assert res.status_code == status.HTTP_403_FORBIDDEN
