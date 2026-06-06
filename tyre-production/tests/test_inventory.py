"""Tests: inventory — StockTransaction + otomasi perhitungan stok."""
import pytest
from decimal import Decimal
from rest_framework import status

from inventory.models import StockTransaction
from specification.models import Material
from .factories import UserFactory, MaterialFactory


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=UserFactory())
    return client


@pytest.mark.django_db
class TestStockTransactionModel:
    def test_str(self):
        mat = MaterialFactory(kode='M-001')
        tx = StockTransaction.objects.create(
            material=mat, type=StockTransaction.TYPE_IN,
            qty=50, stock_before=100, stock_after=150,
            date='2026-05-01',
        )
        assert 'M-001' in str(tx)
        assert 'Penerimaan' in str(tx)


@pytest.mark.django_db
class TestStockTransactionAPI:
    def test_create_type_in_updates_stock(self, api_client):
        mat = MaterialFactory(kode='T-001', stock=Decimal('100.00'))
        payload = {
            'material': mat.pk,
            'type': 'IN',
            'qty': '50.00',
            'date': '2026-05-01',
            'reference': 'PO-EXT-001',
        }
        res = api_client.post('/api/inventory/transactions/', payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['stock_before'] == '100.00'
        assert res.data['stock_after'] == '150.00'

        mat.refresh_from_db()
        assert mat.stock == Decimal('150.00')

    def test_create_type_auto_decreases_stock(self, api_client):
        mat = MaterialFactory(kode='T-002', stock=Decimal('100.00'))
        payload = {
            'material': mat.pk,
            'type': 'AUTO',
            'qty': '30.00',
            'date': '2026-05-01',
        }
        res = api_client.post('/api/inventory/transactions/', payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['stock_after'] == '70.00'

        mat.refresh_from_db()
        assert mat.stock == Decimal('70.00')

    def test_stock_before_readonly(self, api_client):
        """Client tidak bisa inject nilai stock_before."""
        mat = MaterialFactory(kode='T-003', stock=Decimal('200.00'))
        payload = {
            'material': mat.pk, 'type': 'IN',
            'qty': '10.00', 'date': '2026-05-01',
            'stock_before': '999.00',  # injected — harus diabaikan
        }
        res = api_client.post('/api/inventory/transactions/', payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['stock_before'] == '200.00'

    def test_filter_by_type(self, api_client):
        mat = MaterialFactory(kode='F-001', stock=Decimal('200'))
        for tx_type in ['IN', 'AUTO', 'IN']:
            StockTransaction.objects.create(
                material=mat, type=tx_type, qty=10,
                stock_before=100, stock_after=110, date='2026-05-01',
            )
        res = api_client.get('/api/inventory/transactions/?type=IN')
        assert res.status_code == status.HTTP_200_OK
        assert all(r['type'] == 'IN' for r in res.data['results'])

    def test_by_material_endpoint(self, api_client):
        mat1 = MaterialFactory(kode='BM-001', stock=Decimal('100'))
        mat2 = MaterialFactory(kode='BM-002', stock=Decimal('100'))
        StockTransaction.objects.create(
            material=mat1, type='IN', qty=10,
            stock_before=100, stock_after=110, date='2026-05-01',
        )
        StockTransaction.objects.create(
            material=mat2, type='IN', qty=20,
            stock_before=100, stock_after=120, date='2026-05-01',
        )
        res = api_client.get(f'/api/inventory/transactions/by-material/{mat1.pk}/')
        assert res.status_code == status.HTTP_200_OK
        assert all(r['material'] == mat1.pk for r in res.data['results'])

    def test_unauthenticated_blocked(self):
        from rest_framework.test import APIClient
        res = APIClient().get('/api/inventory/transactions/')
        assert res.status_code == status.HTTP_401_UNAUTHORIZED
