import math


def aggregate_requirements(order_items_qs, exclude_order_id=None):
    """
    Hitung total kebutuhan material untuk sekumpulan order items.
    Roll materials (unit='m') dikonversi ke ROLL via ceil(total_m / roll_length).
    PCE materials dikalikan langsung.

    available = stock - locked (reservasi dari order lain yang masih aktif).
    shortage  = available - qty_needed  (negatif berarti kurang).

    exclude_order_id: lewati reservasi milik order ini sendiri (saat re-check).
    """
    from django.db.models import Sum, Q
    from .models import StockReservation

    lock_filter = Q(order__status__in=['CONFIRMED', 'MAT_SENT', 'IN_PROGRESS'])
    if exclude_order_id:
        lock_filter &= ~Q(order_id=exclude_order_id)

    locked = {
        r['material']: float(r['total'])
        for r in StockReservation.objects
            .filter(lock_filter)
            .values('material')
            .annotate(total=Sum('qty_reserved'))
    }

    agg = {}
    for item in order_items_qs:
        for bom in item.tyre_spec.bom_items.select_related('material').all():
            mat = bom.material
            mid = mat.id
            if mat.roll_length and bom.unit == 'm':
                total_m = float(bom.qty) * item.qty_plan
                qty  = math.ceil(total_m / float(mat.roll_length))
                unit = 'ROLL'
            else:
                qty  = float(bom.qty) * item.qty_plan
                unit = mat.unit

            if mid not in agg:
                locked_qty = locked.get(mid, 0.0)
                available  = round(float(mat.stock) - locked_qty, 2)
                agg[mid] = {
                    'material_id': mid,
                    'kode':        mat.kode,
                    'name':        mat.name,
                    'unit':        unit,
                    'stock':       float(mat.stock),
                    'locked':      round(locked_qty, 2),
                    'available':   available,
                    'qty_needed':  0,
                }
            agg[mid]['qty_needed'] += qty

    result = []
    for req in agg.values():
        req['shortage']  = round(req['available'] - req['qty_needed'], 2)
        req['is_short']  = req['shortage'] < 0
        result.append(req)
    return result
