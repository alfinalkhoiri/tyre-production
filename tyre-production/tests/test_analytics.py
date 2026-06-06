"""Tests: analytics endpoints dan export CSV/JSON."""
import pytest
from decimal import Decimal
from rest_framework import status
from rest_framework.test import APIClient

from .factories import UserFactory, MaterialFactory, DailyUsageFactory, DailyUsageEntryFactory
from production.models import DailyUsageEntry


@pytest.fixture
def api_client():
    client = APIClient()
    client.force_authenticate(user=UserFactory())
    return client


def _seed_usage(date, shift, material, qty):
    usage = DailyUsageFactory(date=date, shift=shift)
    return DailyUsageEntry.objects.create(daily_usage=usage, material=material, qty=qty)


@pytest.mark.django_db
class TestMaterialUsageSummary:
    def test_returns_totals(self, api_client):
        mat = MaterialFactory(kode='AN-001', stock=Decimal('500'))
        _seed_usage('2026-04-01', '1', mat, Decimal('10'))
        _seed_usage('2026-04-02', '2', mat, Decimal('20'))

        res = api_client.get('/api/production/analytics/material-usage/?from=2026-04-01&to=2026-04-30')
        assert res.status_code == status.HTTP_200_OK
        row = next(r for r in res.data['results'] if r['material__kode'] == 'AN-001')
        assert Decimal(str(row['total_qty'])) == Decimal('30')
        assert row['entry_count'] == 2

    def test_filter_by_material_id(self, api_client):
        mat1 = MaterialFactory(kode='AN-002', stock=Decimal('100'))
        mat2 = MaterialFactory(kode='AN-003', stock=Decimal('100'))
        _seed_usage('2026-04-01', '1', mat1, Decimal('5'))
        _seed_usage('2026-04-01', '2', mat2, Decimal('8'))

        res = api_client.get(
            f'/api/production/analytics/material-usage/?from=2026-01-01&to=2026-12-31&material_id={mat1.pk}'
        )
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 1
        assert res.data['results'][0]['material__kode'] == 'AN-002'

    def test_empty_range_returns_empty(self, api_client):
        res = api_client.get('/api/production/analytics/material-usage/?from=2000-01-01&to=2000-01-02')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['results'] == []

    def test_requires_auth(self):
        res = APIClient().get('/api/production/analytics/material-usage/')
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestDailyTrend:
    def test_group_by_day(self, api_client):
        mat = MaterialFactory(kode='TR-001', stock=Decimal('500'))
        _seed_usage('2026-04-01', '1', mat, Decimal('10'))
        _seed_usage('2026-04-02', '1', mat, Decimal('15'))

        res = api_client.get(
            '/api/production/analytics/daily-trend/?from=2026-04-01&to=2026-04-30&group_by=day'
        )
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 2

    def test_group_by_month(self, api_client):
        mat = MaterialFactory(kode='TR-002', stock=Decimal('500'))
        _seed_usage('2026-03-10', '1', mat, Decimal('5'))
        _seed_usage('2026-03-20', '2', mat, Decimal('7'))
        _seed_usage('2026-04-05', '1', mat, Decimal('9'))

        res = api_client.get(
            f'/api/production/analytics/daily-trend/?from=2026-01-01&to=2026-12-31&group_by=month&material_id={mat.pk}'
        )
        assert res.status_code == status.HTTP_200_OK
        # Maret dan April → 2 baris
        assert len(res.data['results']) == 2
        totals = {str(r['period'])[:7]: Decimal(str(r['total_qty'])) for r in res.data['results']}
        assert totals['2026-03'] == Decimal('12')
        assert totals['2026-04'] == Decimal('9')


@pytest.mark.django_db
class TestShiftSummary:
    def test_groups_by_shift(self, api_client):
        mat = MaterialFactory(kode='SH-001', stock=Decimal('500'))
        _seed_usage('2026-04-01', '1', mat, Decimal('10'))
        _seed_usage('2026-04-02', '1', mat, Decimal('20'))
        _seed_usage('2026-04-03', '2', mat, Decimal('15'))

        res = api_client.get('/api/production/analytics/shift-summary/')
        assert res.status_code == status.HTTP_200_OK
        by_shift = {r['daily_usage__shift']: r for r in res.data['results']
                    if r['material__kode'] == 'SH-001'}
        assert Decimal(str(by_shift['1']['total_qty'])) == Decimal('30')
        assert Decimal(str(by_shift['2']['total_qty'])) == Decimal('15')


@pytest.mark.django_db
class TestExportCSV:
    def test_export_returns_csv(self, api_client):
        mat = MaterialFactory(kode='EX-001', stock=Decimal('100'))
        _seed_usage('2026-05-01', '1', mat, Decimal('7.5'))

        res = api_client.get('/api/production/analytics/export/csv/?from=2026-05-01&to=2026-05-31')
        assert res.status_code == status.HTTP_200_OK
        assert 'text/csv' in res['Content-Type']

        content = b''.join(res.streaming_content).decode()
        assert 'date,shift' in content
        assert 'EX-001' in content
        assert '7.5' in content

    def test_csv_header_row(self, api_client):
        res = api_client.get('/api/production/analytics/export/csv/')
        content = b''.join(res.streaming_content).decode()
        first_line = content.splitlines()[0]
        assert first_line == 'date,shift,order_number,material_kode,material_name,unit,qty'

    def test_export_requires_auth(self):
        res = APIClient().get('/api/production/analytics/export/csv/')
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestExportJSON:
    def test_export_returns_ndjson(self, api_client):
        mat = MaterialFactory(kode='EXJ-001', stock=Decimal('100'))
        _seed_usage('2026-05-01', '1', mat, Decimal('3.0'))

        res = api_client.get('/api/production/analytics/export/json/?from=2026-05-01&to=2026-05-31')
        assert res.status_code == status.HTTP_200_OK
        assert 'ndjson' in res['Content-Type']

        import json
        lines = [l for l in b''.join(res.streaming_content).decode().splitlines() if l.strip()]
        row = json.loads(lines[0])
        assert row['material_kode'] == 'EXJ-001'
        assert row['qty'] == 3.0
        assert 'date' in row
        assert 'shift' in row
