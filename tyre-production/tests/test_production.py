"""Tests: production orders, daily usage, signal otomasi stok."""
import pytest
from decimal import Decimal
from rest_framework import status

from production.models import ProductionOrder, DailyUsage, DailyUsageEntry
from inventory.models import StockTransaction
from specification.models import Material
from .factories import (
    UserFactory, MaterialFactory, TyreSpecFactory,
    ProductionOrderFactory, DailyUsageFactory, DailyUsageEntryFactory,
)


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    client = APIClient()
    client.force_authenticate(user=UserFactory())
    return client


# ── Model tests ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestProductionOrderModel:
    def test_str(self):
        order = ProductionOrderFactory(number='PO-001', shift='1')
        assert 'PO-001' in str(order)
        assert 'Shift 1' in str(order)

    def test_default_status_draft(self):
        order = ProductionOrderFactory()
        assert order.status == ProductionOrder.STATUS_DRAFT


@pytest.mark.django_db
class TestDailyUsageModel:
    def test_str(self):
        usage = DailyUsageFactory(shift='2')
        assert 'Shift 2' in str(usage)

    def test_unique_date_shift(self):
        from django.db import IntegrityError
        DailyUsageFactory(date='2026-05-01', shift='1')
        with pytest.raises(IntegrityError):
            DailyUsageFactory(date='2026-05-01', shift='1')


# ── Signal: auto StockTransaction ─────────────────────────────────────────────

@pytest.mark.django_db
class TestAutoStockSignal:
    def test_signal_creates_stock_transaction(self):
        mat   = MaterialFactory(kode='SIG-001', stock=Decimal('100.00'))
        usage = DailyUsageFactory(date='2026-05-01', shift='1')

        entry = DailyUsageEntry.objects.create(
            daily_usage=usage, material=mat, qty=Decimal('15.00')
        )

        tx = StockTransaction.objects.filter(
            material=mat, type=StockTransaction.TYPE_AUTO
        ).last()
        assert tx is not None
        assert tx.qty == Decimal('15.00')
        assert tx.stock_before == Decimal('100.00')
        assert tx.stock_after == Decimal('85.00')
        entry.daily_usage.refresh_from_db()
        assert tx.date == entry.daily_usage.date

    def test_signal_updates_material_stock(self):
        mat   = MaterialFactory(kode='SIG-002', stock=Decimal('200.00'))
        usage = DailyUsageFactory(date='2026-05-01', shift='2')

        DailyUsageEntry.objects.create(
            daily_usage=usage, material=mat, qty=Decimal('50.00')
        )

        mat.refresh_from_db()
        assert mat.stock == Decimal('150.00')

    def test_signal_not_fired_on_update(self):
        mat   = MaterialFactory(kode='SIG-003', stock=Decimal('100.00'))
        usage = DailyUsageFactory(date='2026-05-01', shift='3')
        entry = DailyUsageEntry.objects.create(
            daily_usage=usage, material=mat, qty=Decimal('10.00')
        )
        tx_count_before = StockTransaction.objects.filter(material=mat).count()

        # update entry — signal tidak boleh bikin transaksi baru
        entry.qty = Decimal('20.00')
        entry.save()

        assert StockTransaction.objects.filter(material=mat).count() == tx_count_before

    def test_signal_sequential_entries_accumulate(self):
        mat    = MaterialFactory(kode='SIG-004', stock=Decimal('100.00'))
        usage1 = DailyUsageFactory(date='2026-05-01', shift='1')
        usage2 = DailyUsageFactory(date='2026-05-02', shift='1')

        DailyUsageEntry.objects.create(daily_usage=usage1, material=mat, qty=Decimal('20.00'))
        DailyUsageEntry.objects.create(daily_usage=usage2, material=mat, qty=Decimal('30.00'))

        mat.refresh_from_db()
        assert mat.stock == Decimal('50.00')
        assert StockTransaction.objects.filter(material=mat).count() == 2


# ── API: Production Order status transitions ──────────────────────────────────

@pytest.mark.django_db
class TestProductionOrderAPI:
    def test_create_order(self, api_client):
        payload = {
            'number': 'PO-2026-TEST',
            'date': '2026-05-16',
            'shift': '1',
            'pic': 'Budi Santoso',
        }
        res = api_client.post('/api/production/orders/', payload)
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data['status'] == 'DRAFT'

    def test_confirm_transition(self, api_client):
        order = ProductionOrderFactory(status=ProductionOrder.STATUS_DRAFT)
        res = api_client.post(f'/api/production/orders/{order.pk}/confirm/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'CONFIRMED'

    def test_confirm_only_from_draft(self, api_client):
        order = ProductionOrderFactory(status=ProductionOrder.STATUS_CONFIRMED)
        res = api_client.post(f'/api/production/orders/{order.pk}/confirm/')
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_start_transition(self, api_client):
        order = ProductionOrderFactory(status=ProductionOrder.STATUS_CONFIRMED)
        res = api_client.post(f'/api/production/orders/{order.pk}/start/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'IN_PROGRESS'

    def test_done_transition(self, api_client):
        order = ProductionOrderFactory(status=ProductionOrder.STATUS_IN_PROGRESS)
        res = api_client.post(f'/api/production/orders/{order.pk}/done/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['status'] == 'DONE'

    def test_full_status_flow(self, api_client):
        order = ProductionOrderFactory()
        pk = order.pk
        api_client.post(f'/api/production/orders/{pk}/confirm/')
        api_client.post(f'/api/production/orders/{pk}/start/')
        res = api_client.post(f'/api/production/orders/{pk}/done/')
        assert res.data['status'] == 'DONE'

    def test_filter_by_status(self, api_client):
        ProductionOrderFactory(status=ProductionOrder.STATUS_DRAFT)
        ProductionOrderFactory(status=ProductionOrder.STATUS_DONE)
        res = api_client.get('/api/production/orders/?status=DRAFT')
        assert res.status_code == status.HTTP_200_OK
        assert all(r['status'] == 'DRAFT' for r in res.data['results'])


# ── API: DailyUsage nested write ───────────────────────────────────────────────

@pytest.mark.django_db
class TestDailyUsageAPI:
    def test_create_with_entries(self, api_client):
        mat1 = MaterialFactory(kode='DU-001', stock=Decimal('100'))
        mat2 = MaterialFactory(kode='DU-002', stock=Decimal('200'))
        order = ProductionOrderFactory()

        payload = {
            'date': '2026-05-16',
            'shift': '1',
            'order': order.pk,
            'note': 'Shift pagi normal',
            'entries': [
                {'material': mat1.pk, 'qty': '10.00'},
                {'material': mat2.pk, 'qty': '25.50'},
            ],
        }
        res = api_client.post('/api/production/daily-usages/', payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        assert DailyUsageEntry.objects.filter(daily_usage__date='2026-05-16').count() == 2

        mat1.refresh_from_db()
        assert mat1.stock == Decimal('90.00')

    def test_date_range_filter(self, api_client):
        DailyUsageFactory(date='2026-03-01', shift='1')
        DailyUsageFactory(date='2026-04-01', shift='1')
        DailyUsageFactory(date='2026-05-01', shift='1')
        res = api_client.get(
            '/api/production/daily-usages/range/?from=2026-04-01&to=2026-04-30'
        )
        assert res.status_code == status.HTTP_200_OK
        dates = [r['date'] for r in res.data]
        assert all('2026-04' in d for d in dates)

    def test_unique_date_shift_constraint(self, api_client):
        order = ProductionOrderFactory()
        payload = {'date': '2026-05-16', 'shift': '2', 'order': order.pk, 'entries': []}
        api_client.post('/api/production/daily-usages/', payload, format='json')
        res = api_client.post('/api/production/daily-usages/', payload, format='json')
        assert res.status_code == status.HTTP_400_BAD_REQUEST
