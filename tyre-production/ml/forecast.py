"""
Estimasi kebutuhan material berbasis Average Daily Consumption (ADC).
Murni aritmetika — tanpa ML, tanpa training, tanpa model tersimpan.
"""
from datetime import date, timedelta

WINDOW_WEIGHTS  = (0.5, 0.3, 0.2)   # bobot untuk adc_7, adc_14, adc_30
LEAD_TIME_DAYS  = 7
SAFETY_DAYS     = 7
DEFAULT_HORIZON = 7


def compute_adc(daily_series: list) -> dict:
    """
    Hitung ADC berbobot dari deret pemakaian harian.
    daily_series: list of (date, qty) diurutkan dari lama ke baru.
    Kembalikan dict: adc_7, adc_14, adc_30, adc.
    """
    today = date.today()

    def _window_avg(days):
        cutoff = today - timedelta(days=days)
        vals = [qty for d, qty in daily_series if d >= cutoff]
        return sum(vals) / len(vals) if vals else None

    w7  = _window_avg(7)
    w14 = _window_avg(14)
    w30 = _window_avg(30)

    adc_7  = w7  if w7  is not None else 0.0
    adc_14 = w14 if w14 is not None else 0.0
    adc_30 = w30 if w30 is not None else 0.0

    if w7 is None:     # tidak ada data sama sekali
        adc = 0.0
    elif w14 is None:  # data kurang dari 14 hari, pakai adc_7 saja
        adc = adc_7
    else:              # data cukup, gunakan bobot penuh
        wt7, wt14, wt30 = WINDOW_WEIGHTS
        adc = wt7 * adc_7 + wt14 * adc_14 + wt30 * adc_30

    return {
        'adc_7':  round(adc_7,  2),
        'adc_14': round(adc_14, 2),
        'adc_30': round(adc_30, 2),
        'adc':    round(adc,    2),
    }


def estimate_material(material, daily_series: list, horizon: int = DEFAULT_HORIZON) -> dict:
    """
    Hitung estimasi kebutuhan untuk satu material.
    material: instance Material (Django model).
    daily_series: list of (date, qty).
    """
    current_stock = float(material.stock)
    safety        = float(material.safety_stock)

    adc_info       = compute_adc(daily_series)
    adc            = adc_info['adc']
    predicted_total = round(adc * horizon, 2)
    projected_stock = round(current_stock - predicted_total, 2)
    days_remaining  = round(current_stock / adc, 1) if adc > 0 else None

    if adc == 0:
        status = 'aman'
    elif days_remaining is not None and days_remaining <= LEAD_TIME_DAYS:
        status = 'perlu_pesan'
    elif projected_stock < safety:
        status = 'perlu_pesan'
    else:
        status = 'aman'

    target_stock    = adc * (LEAD_TIME_DAYS + SAFETY_DAYS)
    suggested_order = round(max(0.0, target_stock - current_stock), 2)

    return {
        'material_id':     material.id,
        'kode':            material.kode,
        'name':            material.name,
        'unit':            material.unit,
        'current_stock':   current_stock,
        'safety_stock':    safety,
        'adc':             adc,
        'adc_7':           adc_info['adc_7'],
        'adc_14':          adc_info['adc_14'],
        'adc_30':          adc_info['adc_30'],
        'predicted_daily': adc,
        'predicted_total': predicted_total,
        'days_remaining':  days_remaining,
        'projected_stock': projected_stock,
        'status':          status,
        'suggested_order': suggested_order,
    }


def estimate_all(horizon: int = DEFAULT_HORIZON) -> list:
    """Loop seluruh material dan kembalikan daftar estimasi."""
    from collections import defaultdict
    from django.db.models import Sum
    from production.models import DailyUsageEntry
    from specification.models import Material

    rows = (
        DailyUsageEntry.objects
        .values('material_id', 'daily_usage__date')
        .annotate(day_qty=Sum('qty'))
        .order_by('material_id', 'daily_usage__date')
    )

    usage: dict = defaultdict(list)
    for r in rows:
        usage[r['material_id']].append((r['daily_usage__date'], float(r['day_qty'])))

    return [
        estimate_material(mat, usage.get(mat.id, []), horizon)
        for mat in Material.objects.order_by('kode')
    ]
