"""
Unit tests untuk ml/forecast.py — murni aritmetika, tanpa DB.
"""
from datetime import date, timedelta
from django.test import SimpleTestCase
from ml.forecast import compute_adc, estimate_material, LEAD_TIME_DAYS


class _FakeMaterial:
    def __init__(self, mid=1, kode='MAT-001', name='Test Material', unit='PCE', stock=100.0, safety_stock=20.0):
        self.id           = mid
        self.kode         = kode
        self.name         = name
        self.unit         = unit
        self.stock        = stock
        self.safety_stock = safety_stock


def _series(n_days, qty_per_day=5.0):
    """Buat deret pemakaian konstan selama n_days hari terakhir."""
    today = date.today()
    return [(today - timedelta(days=i), qty_per_day) for i in range(n_days)]


class ComputeAdcTests(SimpleTestCase):
    def test_constant_series_returns_correct_adc(self):
        series = _series(30, qty_per_day=10.0)
        result = compute_adc(series)
        self.assertAlmostEqual(result['adc'],    10.0, places=1)
        self.assertAlmostEqual(result['adc_7'],  10.0, places=1)
        self.assertAlmostEqual(result['adc_14'], 10.0, places=1)
        self.assertAlmostEqual(result['adc_30'], 10.0, places=1)

    def test_no_data_returns_zero(self):
        result = compute_adc([])
        self.assertEqual(result['adc'], 0.0)
        self.assertEqual(result['adc_7'], 0.0)

    def test_less_than_14_days_uses_adc_7(self):
        series = _series(5, qty_per_day=8.0)
        result = compute_adc(series)
        self.assertAlmostEqual(result['adc'], result['adc_7'], places=2)

    def test_weighted_average_recent_heavier(self):
        today = date.today()
        # 7 hari terakhir: 20/hari, 14 hari sebelumnya: 5/hari
        series = (
            [(today - timedelta(days=i), 20.0) for i in range(7)] +
            [(today - timedelta(days=7 + i), 5.0) for i in range(23)]
        )
        result = compute_adc(series)
        # adc harus lebih dekat ke 20 (baru) daripada 5 (lama)
        self.assertGreater(result['adc'], 10.0)


class EstimateMaterialTests(SimpleTestCase):
    def test_status_aman_when_stock_sufficient(self):
        mat    = _FakeMaterial(stock=500.0, safety_stock=20.0)
        series = _series(30, qty_per_day=5.0)
        result = estimate_material(mat, series, horizon=7)
        self.assertEqual(result['status'], 'aman')

    def test_status_perlu_pesan_when_days_remaining_low(self):
        # ADC=10, stok=50 → sisa hari = 5 (< LEAD_TIME_DAYS=7)
        mat    = _FakeMaterial(stock=50.0, safety_stock=5.0)
        series = _series(30, qty_per_day=10.0)
        result = estimate_material(mat, series, horizon=7)
        self.assertEqual(result['status'], 'perlu_pesan')
        self.assertLessEqual(result['days_remaining'], LEAD_TIME_DAYS)

    def test_status_perlu_pesan_when_projected_below_safety(self):
        # ADC=5, stok=40, safety=30, horizon=7 → proyeksi=40-35=5 < 30
        mat    = _FakeMaterial(stock=40.0, safety_stock=30.0)
        series = _series(30, qty_per_day=5.0)
        result = estimate_material(mat, series, horizon=7)
        self.assertEqual(result['status'], 'perlu_pesan')

    def test_no_usage_data_status_aman(self):
        mat    = _FakeMaterial(stock=100.0, safety_stock=10.0)
        result = estimate_material(mat, [], horizon=7)
        self.assertEqual(result['status'], 'aman')
        self.assertEqual(result['adc'], 0.0)
        self.assertIsNone(result['days_remaining'])

    def test_suggested_order_zero_when_stock_above_target(self):
        # target = adc * (7+7) = 5*14 = 70; stok=500 → saran = 0
        mat    = _FakeMaterial(stock=500.0, safety_stock=10.0)
        series = _series(30, qty_per_day=5.0)
        result = estimate_material(mat, series)
        self.assertEqual(result['suggested_order'], 0.0)

    def test_suggested_order_positive_when_stock_low(self):
        # target = 5*14=70; stok=10 → saran = 60
        mat    = _FakeMaterial(stock=10.0, safety_stock=5.0)
        series = _series(30, qty_per_day=5.0)
        result = estimate_material(mat, series)
        self.assertGreater(result['suggested_order'], 0)
