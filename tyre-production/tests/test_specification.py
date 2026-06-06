"""Tests: specification models dan API endpoints."""
import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework import status

from specification.models import Material, TyreSpec, BOMItem
from .factories import UserFactory, MaterialFactory, TyreSpecFactory, BOMItemFactory


@pytest.fixture
def auth_client(client):
    user = UserFactory()
    client.force_login(user)
    return client


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def authenticated_api_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


# ── Model tests ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMaterialModel:
    def test_str(self):
        mat = MaterialFactory(kode='MAT-001', name='Karet Alam')
        assert str(mat) == '[MAT-001] Karet Alam'

    def test_kode_unique(self):
        from django.db import IntegrityError
        MaterialFactory(kode='SAME')
        with pytest.raises(IntegrityError):
            MaterialFactory(kode='SAME')

    def test_default_stock_zero(self):
        mat = Material.objects.create(
            kode='X001', name='Test', unit='kg', roll_length=100
        )
        assert mat.stock == 0
        assert mat.safety_stock == 0


@pytest.mark.django_db
class TestTyreSpecModel:
    def test_str_with_variant(self):
        spec = TyreSpecFactory(size='185/65R15', model='EcoContact', variant='XL')
        assert str(spec) == '185/65R15 - EcoContact - XL'

    def test_str_without_variant(self):
        spec = TyreSpecFactory(size='185/65R15', model='EcoContact', variant='')
        assert str(spec) == '185/65R15 - EcoContact'

    def test_unique_together(self):
        from django.db import IntegrityError
        TyreSpecFactory(size='185/65R15', model='Eco', variant='V0')
        with pytest.raises(IntegrityError):
            TyreSpecFactory(size='185/65R15', model='Eco', variant='V0')


@pytest.mark.django_db
class TestBOMItemModel:
    def test_tyre_per_roll(self):
        mat  = MaterialFactory(roll_length=Decimal('100.00'))
        item = BOMItemFactory(material=mat, qty=Decimal('5.0000'))
        assert item.tyre_per_roll == pytest.approx(20.0)

    def test_roll_per_100_tyre(self):
        mat  = MaterialFactory(roll_length=Decimal('100.00'))
        item = BOMItemFactory(material=mat, qty=Decimal('5.0000'))
        assert item.roll_per_100_tyre == pytest.approx(5.0)

    def test_tyre_per_roll_zero_qty(self):
        mat  = MaterialFactory(roll_length=Decimal('100.00'))
        item = BOMItemFactory.build(material=mat, qty=Decimal('0'))
        assert item.tyre_per_roll is None
        assert item.roll_per_100_tyre is None

    def test_str(self):
        item = BOMItemFactory()
        assert item.material.kode in str(item)


# ── API tests ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMaterialAPI:
    def test_list_requires_auth(self, api_client):
        res = api_client.get('/api/spec/materials/')
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_list_authenticated(self, authenticated_api_client):
        MaterialFactory.create_batch(3)
        res = authenticated_api_client.get('/api/spec/materials/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['count'] >= 3

    def test_create(self, authenticated_api_client):
        payload = {
            'kode': 'NEW-001', 'name': 'Bahan Baru',
            'unit': 'kg', 'roll_length': '50.00',
            'stock': '100.00', 'safety_stock': '20.00',
        }
        res = authenticated_api_client.post('/api/spec/materials/', payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert Material.objects.filter(kode='NEW-001').exists()

    def test_create_duplicate_kode(self, authenticated_api_client):
        MaterialFactory(kode='DUP-001')
        payload = {
            'kode': 'DUP-001', 'name': 'Duplikat',
            'unit': 'kg', 'roll_length': '10.00',
        }
        res = authenticated_api_client.post('/api/spec/materials/', payload)
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_low_stock_endpoint(self, authenticated_api_client):
        # stock > safety_stock → tidak masuk
        MaterialFactory(kode='OK-001', stock=Decimal('100'), safety_stock=Decimal('10'))
        # stock <= safety_stock → masuk
        MaterialFactory(kode='LOW-001', stock=Decimal('5'), safety_stock=Decimal('20'))

        res = authenticated_api_client.get('/api/spec/materials/low-stock/')
        assert res.status_code == status.HTTP_200_OK
        kodes = [m['kode'] for m in res.data]
        assert 'LOW-001' in kodes
        assert 'OK-001' not in kodes

    def test_search(self, authenticated_api_client):
        MaterialFactory(kode='SR-001', name='Karet Alam')
        MaterialFactory(kode='SR-002', name='Carbon Black')
        res = authenticated_api_client.get('/api/spec/materials/?search=Karet')
        assert res.status_code == status.HTTP_200_OK
        assert all('Karet' in r['name'] for r in res.data['results'])

    def test_detail_update(self, authenticated_api_client):
        mat = MaterialFactory(kode='UPD-001', stock=Decimal('100'))
        res = authenticated_api_client.patch(
            f'/api/spec/materials/{mat.pk}/',
            {'stock': '200.00'},
        )
        assert res.status_code == status.HTTP_200_OK
        mat.refresh_from_db()
        assert mat.stock == Decimal('200.00')

    def test_delete(self, authenticated_api_client):
        mat = MaterialFactory(kode='DEL-001')
        res = authenticated_api_client.delete(f'/api/spec/materials/{mat.pk}/')
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not Material.objects.filter(pk=mat.pk).exists()


@pytest.mark.django_db
class TestTyreSpecAPI:
    def test_list_returns_light_serializer(self, authenticated_api_client):
        TyreSpecFactory.create_batch(2)
        res = authenticated_api_client.get('/api/spec/tyre-specs/')
        assert res.status_code == status.HTTP_200_OK
        # list serializer tidak mengembalikan bom_items
        assert 'bom_items' not in res.data['results'][0]

    def test_detail_returns_bom_items(self, authenticated_api_client):
        spec = TyreSpecFactory()
        BOMItemFactory.create_batch(3, tyre_spec=spec)
        res = authenticated_api_client.get(f'/api/spec/tyre-specs/{spec.pk}/')
        assert res.status_code == status.HTTP_200_OK
        assert 'bom_items' in res.data
        assert len(res.data['bom_items']) == 3

    def test_filter_by_size(self, authenticated_api_client):
        TyreSpecFactory(size='185/65R15', model='A', variant='v1')
        TyreSpecFactory(size='205/55R16', model='B', variant='v2')
        res = authenticated_api_client.get('/api/spec/tyre-specs/?size=185%2F65R15')
        assert res.status_code == status.HTTP_200_OK
        assert all(r['size'] == '185/65R15' for r in res.data['results'])
