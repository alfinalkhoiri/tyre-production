import math


def aggregate_requirements(order_items_qs):
    """
    Calculate total material requirements for a set of order items.
    Roll materials (unit='m') are converted to ROLLs using ceil(total_m / roll_length).
    PCE materials are multiplied directly.
    Returns a list of dicts with: material_id, kode, name, unit, qty_needed, stock, shortage, is_short.
    """
    agg = {}
    for item in order_items_qs:
        for bom in item.tyre_spec.bom_items.select_related('material').all():
            mat = bom.material
            mid = mat.id
            if mat.roll_length and bom.unit == 'm':
                total_m = float(bom.qty) * item.qty_plan
                qty = math.ceil(total_m / float(mat.roll_length))
                unit = 'ROLL'
            else:
                qty = float(bom.qty) * item.qty_plan
                unit = mat.unit

            if mid not in agg:
                agg[mid] = {
                    'material_id': mid,
                    'kode': mat.kode,
                    'name': mat.name,
                    'unit': unit,
                    'stock': float(mat.stock),
                    'qty_needed': 0,
                }
            agg[mid]['qty_needed'] += qty

    result = []
    for req in agg.values():
        req['shortage'] = round(req['stock'] - req['qty_needed'], 2)
        req['is_short'] = req['shortage'] < 0
        result.append(req)
    return result
