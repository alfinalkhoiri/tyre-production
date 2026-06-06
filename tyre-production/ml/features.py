"""
Feature engineering untuk model forecasting pemakaian material.
"""
import pandas as pd
import numpy as np


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Buat fitur time-series dari DataFrame raw.
    Input wajib punya kolom: date, shift, material_id, qty.
    Output: DataFrame siap pakai sebagai X dan y untuk training.
    """
    df = df.copy()

    # Fitur kalender
    df['day_of_week']  = df['date'].dt.dayofweek          # 0=Senin … 6=Minggu
    df['day_of_month'] = df['date'].dt.day
    df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
    df['month']        = df['date'].dt.month
    df['is_weekend']   = (df['day_of_week'] >= 5).astype(int)

    # Fitur shift sudah integer (1/2/3)
    # Lag & rolling per (material_id, shift) agar tidak cross-contaminate antar shift
    df = df.sort_values(['material_id', 'shift', 'date']).reset_index(drop=True)

    group_key = ['material_id', 'shift']

    # Lag 1 shift sebelumnya (1 hari, shift yg sama)
    df['lag_1'] = df.groupby(group_key)['qty'].shift(1)
    # Lag 7 hari
    df['lag_7'] = df.groupby(group_key)['qty'].shift(7)
    # Rolling mean 7 & 30 hari (min_periods=1 agar tidak buang data awal)
    df['roll_7_mean']  = (
        df.groupby(group_key)['qty']
        .transform(lambda s: s.shift(1).rolling(7,  min_periods=1).mean())
    )
    df['roll_30_mean'] = (
        df.groupby(group_key)['qty']
        .transform(lambda s: s.shift(1).rolling(30, min_periods=1).mean())
    )

    # Isi NaN lag dengan rata-rata kolom (cold-start)
    for col in ['lag_1', 'lag_7', 'roll_7_mean', 'roll_30_mean']:
        df[col] = df[col].fillna(df.groupby('material_id')['qty'].transform('mean'))

    return df


FEATURE_COLS = [
    'shift', 'day_of_week', 'day_of_month', 'week_of_year',
    'month', 'is_weekend',
    'lag_1', 'lag_7', 'roll_7_mean', 'roll_30_mean',
]


def make_future_row(
    material_id: int,
    target_date: pd.Timestamp,
    shift: int,
    history_df: pd.DataFrame,
) -> dict:
    """
    Buat satu baris fitur untuk tanggal di masa depan (tidak ada data aktual).
    history_df: semua entri historis untuk material + shift ini.
    """
    row = {
        'shift':         shift,
        'day_of_week':   target_date.dayofweek,
        'day_of_month':  target_date.day,
        'week_of_year':  target_date.isocalendar().week,
        'month':         target_date.month,
        'is_weekend':    int(target_date.dayofweek >= 5),
    }

    recent = history_df[
        (history_df['material_id'] == material_id) &
        (history_df['shift'] == shift)
    ].sort_values('date')

    qtys = recent['qty'].tolist()
    row['lag_1']       = qtys[-1]  if len(qtys) >= 1  else 0.0
    row['lag_7']       = qtys[-7]  if len(qtys) >= 7  else (sum(qtys) / len(qtys) if qtys else 0.0)
    row['roll_7_mean'] = float(np.mean(qtys[-7:]))  if qtys else 0.0
    row['roll_30_mean']= float(np.mean(qtys[-30:])) if qtys else 0.0
    return row
