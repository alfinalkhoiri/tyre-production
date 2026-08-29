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


def _login_admin(client, username='adminuser', password='testpass123'):
    user, res = _login(client, username, password)
    user.profile.role = 'admin'
    user.profile.save()
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

    def test_admin_can_register_user(self, client):
        _, login_res = _login_admin(client)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.post('/api/auth/register/', {
            'username': 'newuser2', 'password': 'pass12345', 'role': 'operator',
        })
        assert res.status_code == status.HTTP_201_CREATED


@pytest.mark.django_db
class TestUserManagement:
    def test_list_users_requires_admin(self, client):
        _, login_res = _login(client)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.get('/api/auth/users/')
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_list_users(self, client):
        _, login_res = _login_admin(client)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.get('/api/auth/users/')
        assert res.status_code == status.HTTP_200_OK

    def test_admin_can_update_other_user_role(self, client):
        admin, login_res = _login_admin(client)
        other = UserFactory(username='otheruser')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.patch(f'/api/auth/users/{other.pk}/', {'role': 'operator'})
        assert res.status_code == status.HTTP_200_OK
        assert res.data['role'] == 'operator'  # response tidak boleh stale
        other.profile.refresh_from_db()
        assert other.profile.role == 'operator'

    def test_admin_cannot_demote_own_role(self, client):
        admin, login_res = _login_admin(client)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.patch(f'/api/auth/users/{admin.pk}/', {'role': 'viewer'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        admin.profile.refresh_from_db()
        assert admin.profile.role == 'admin'

    def test_admin_cannot_delete_own_account(self, client):
        admin, login_res = _login_admin(client)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.delete(f'/api/auth/users/{admin.pk}/')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_can_delete_other_user(self, client):
        from django.contrib.auth.models import User
        _, login_res = _login_admin(client)
        other = UserFactory(username='deleteme')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.delete(f'/api/auth/users/{other.pk}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not User.objects.filter(pk=other.pk).exists()


@pytest.mark.django_db
class TestAdminSetPassword:
    def test_requires_admin(self, client):
        _, login_res = _login(client)
        other = UserFactory(username='target1')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.post(f'/api/auth/users/{other.pk}/set-password/', {
            'new_password': 'newSecure456!',
        })
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_can_reset_other_user_password(self, client):
        _, login_res = _login_admin(client)
        other = UserFactory(username='target2', password='oldpass123')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.post(f'/api/auth/users/{other.pk}/set-password/', {
            'new_password': 'newSecure456!',
        })
        assert res.status_code == status.HTTP_200_OK

        # tidak perlu tahu password lama — login pakai password baru harus berhasil
        res2 = client.post('/api/auth/login/', {'username': 'target2', 'password': 'newSecure456!'})
        assert res2.status_code == status.HTTP_200_OK

    def test_rejects_short_password(self, client):
        _, login_res = _login_admin(client)
        other = UserFactory(username='target3')
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {login_res.data["access"]}')
        res = client.post(f'/api/auth/users/{other.pk}/set-password/', {'new_password': 'short'})
        assert res.status_code == status.HTTP_400_BAD_REQUEST
