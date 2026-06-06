"""
Load dan transformasi data DailyUsageEntry dari Django ORM ke pandas DataFrame.
"""
import pandas as pd
from production.models import DailyUsageEntry


def load_usage_dataframe() -> pd.DataFrame:
    """
    Ambil semua DailyUsageEntry dan kembalikan sebagai DataFrame dengan kolom:
    date, shift, material_id, material_kode, material_name, unit, qty
    """
    qs = DailyUsageEntry.objects.select_related(
        'daily_usage', 'material'
    ).values(
        'daily_usage__date',
        'daily_usage__shift',
        'material__id',
        'material__kode',
        'material__name',
        'material__unit',
        'qty',
    )

    df = pd.DataFrame.from_records(qs)
    if df.empty:
        return df

    df = df.rename(columns={
        'daily_usage__date':  'date',
        'daily_usage__shift': 'shift',
        'material__id':       'material_id',
        'material__kode':     'material_kode',
        'material__name':     'material_name',
        'material__unit':     'unit',
    })

    df['date']  = pd.to_datetime(df['date'])
    df['shift'] = df['shift'].astype(int)
    df['qty']   = df['qty'].astype(float)
    return df.sort_values(['date', 'shift', 'material_kode']).reset_index(drop=True)
