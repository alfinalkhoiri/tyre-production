"""
Training, evaluasi, simpan, dan load model forecasting per material.
"""
import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from django.conf import settings
from .features import build_features, FEATURE_COLS

MODEL_DIR = Path(getattr(settings, 'ML_MODEL_DIR', settings.BASE_DIR / 'ml_models'))
MODEL_DIR.mkdir(exist_ok=True)

MIN_ROWS = 10  # minimum data per material untuk melatih model


def _model_path(material_id: int) -> Path:
    return MODEL_DIR / f'material_{material_id}.joblib'


def _meta_path() -> Path:
    return MODEL_DIR / 'training_meta.json'


def train_all(df: pd.DataFrame, verbose: bool = True) -> dict:
    """
    Latih satu model RandomForest per material.
    Kembalikan dict {material_id: metrics}.
    """
    df_feat = build_features(df)
    results = {}

    material_ids = df_feat['material_id'].unique()
    for mat_id in material_ids:
        subset = df_feat[df_feat['material_id'] == mat_id].dropna(subset=FEATURE_COLS + ['qty'])

        if len(subset) < MIN_ROWS:
            if verbose:
                kode = subset['material_kode'].iloc[0] if not subset.empty else mat_id
                print(f'  [SKIP] {kode} — hanya {len(subset)} baris (min {MIN_ROWS})')
            continue

        X = subset[FEATURE_COLS].values
        y = subset['qty'].values

        # TimeSeriesSplit cross-validation
        tscv = TimeSeriesSplit(n_splits=min(3, len(subset) // 3))
        cv_maes = []
        for train_idx, val_idx in tscv.split(X):
            model_cv = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
            model_cv.fit(X[train_idx], y[train_idx])
            preds = model_cv.predict(X[val_idx])
            cv_maes.append(mean_absolute_error(y[val_idx], preds))

        # Train final model pada semua data
        model = RandomForestRegressor(
            n_estimators=200,
            max_depth=10,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X, y)
        final_preds = model.predict(X)

        metrics = {
            'material_id':   int(mat_id),
            'material_kode': str(subset['material_kode'].iloc[0]),
            'n_samples':     int(len(subset)),
            'mae_cv':        float(np.mean(cv_maes)),
            'mae_train':     float(mean_absolute_error(y, final_preds)),
            'rmse_train':    float(np.sqrt(mean_squared_error(y, final_preds))),
            'r2_train':      float(r2_score(y, final_preds)),
            'feature_importance': {
                col: float(imp)
                for col, imp in zip(FEATURE_COLS, model.feature_importances_)
            },
        }

        joblib.dump(model, _model_path(mat_id))
        results[int(mat_id)] = metrics

        if verbose:
            print(
                f'  [OK] {metrics["material_kode"]:20s} | '
                f'n={metrics["n_samples"]:4d} | '
                f'CV MAE={metrics["mae_cv"]:.3f} | '
                f'R²={metrics["r2_train"]:.3f}'
            )

    # Simpan metadata training
    meta = {
        'trained_materials': list(results.keys()),
        'feature_cols': FEATURE_COLS,
        'results': results,
    }
    _meta_path().write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
    return results


def load_model(material_id: int):
    path = _model_path(material_id)
    if not path.exists():
        return None
    return joblib.load(path)


def get_training_meta() -> dict:
    if not _meta_path().exists():
        return {}
    return json.loads(_meta_path().read_text(encoding='utf-8'))


def predict_future(
    material_id: int,
    history_df: pd.DataFrame,
    forecast_days: int = 7,
) -> list[dict]:
    """
    Prediksi pemakaian material untuk `forecast_days` hari ke depan (3 shift/hari).
    Kembalikan list of dicts: {date, shift, predicted_qty, lower, upper}.
    """
    from .features import make_future_row

    model = load_model(material_id)
    if model is None:
        return []

    last_date = history_df['date'].max() if not history_df.empty else pd.Timestamp.today()
    predictions = []
    running_history = history_df.copy()

    for day_offset in range(1, forecast_days + 1):
        target_date = last_date + pd.Timedelta(days=day_offset)
        for shift in [1, 2, 3]:
            row = make_future_row(material_id, target_date, shift, running_history)
            X = np.array([[row[c] for c in FEATURE_COLS]])

            # Prediksi dari tiap tree untuk interval kepercayaan sederhana
            tree_preds = np.array([tree.predict(X)[0] for tree in model.estimators_])
            pred_mean  = float(np.mean(tree_preds))
            pred_std   = float(np.std(tree_preds))

            predictions.append({
                'date':          target_date.strftime('%Y-%m-%d'),
                'shift':         shift,
                'predicted_qty': round(max(0, pred_mean), 3),
                'lower_bound':   round(max(0, pred_mean - 1.96 * pred_std), 3),
                'upper_bound':   round(pred_mean + 1.96 * pred_std, 3),
            })

            # Tambahkan prediksi ke running history agar lag features berikutnya akurat
            new_row = pd.DataFrame([{
                'date': target_date, 'shift': shift,
                'material_id': material_id,
                'material_kode': '', 'material_name': '', 'unit': '',
                'qty': pred_mean,
            }])
            running_history = pd.concat([running_history, new_row], ignore_index=True)

    return predictions
