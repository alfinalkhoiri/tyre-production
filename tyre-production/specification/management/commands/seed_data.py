from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from accounts.models import UserProfile
from specification.models import Material, TyreSpec, BOMItem
from inventory.models import StockTransaction
from production.models import (
    ProductionOrder, ProductionOrderItem, DailyUsage, DailyUsageEntry,
    MaterialShipment, TyreDelivery,
)


MATERIALS = [
    {"id": 1,  "name": "Tread Roll",            "kode": "TREAD-ROLL",  "category": "Tread",     "unit": "ROLL", "roll_length": 80,   "stock": 0, "safety_stock": 50},
    {"id": 2,  "name": "Nylon Carcass Roll",    "kode": "NYLON-CARC",  "category": "Carcass",   "unit": "ROLL", "roll_length": 80,   "stock": 0, "safety_stock": 50},
    {"id": 3,  "name": "Barcode Label",         "kode": "9812050047",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 5000},
    {"id": 4,  "name": "Bead Wire Ø1952",       "kode": "9004010203",  "category": "Bead Wire", "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 2000},
    {"id": 5,  "name": "Bead Wire Ø1829",       "kode": "9004010219",  "category": "Bead Wire", "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 2000},
    {"id": 6,  "name": "Bead Wire Ø1752",       "kode": "BEAD-1752",   "category": "Bead Wire", "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 2000},
    {"id": 7,  "name": "Bead Wire Ø1956",       "kode": "9004010004",  "category": "Bead Wire", "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 2000},
    {"id": 8,  "name": "Label Schwalbe 15mm",   "kode": "9900000504",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 3000},
    {"id": 9,  "name": "Label Schwalbe 10mm",   "kode": "9900000519",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 3000},
    {"id": 10, "name": "Label Schwalbe 6mm",    "kode": "9900001134",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 3000},
    {"id": 11, "name": "Label Smart Sam TS MS", "kode": "9907000243",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 3000},
    {"id": 12, "name": "Label Smart Sam DD GG", "kode": "9907000232",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 3000},
    {"id": 13, "name": "Label Rapid Rob 10mm",  "kode": "9912000590",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 3000},
    {"id": 14, "name": "Chaffer BSK 10mm",      "kode": "9006010011",  "category": "Chaffer",   "unit": "ROLL", "roll_length": 100,  "stock": 0, "safety_stock": 100},
    {"id": 15, "name": "Chaffer BSK 8mm",       "kode": "9006020082",  "category": "Chaffer",   "unit": "ROLL", "roll_length": 100,  "stock": 0, "safety_stock": 100},
    {"id": 16, "name": "Label Road Cruiser 6mm","kode": "9900001632",  "category": "Label",     "unit": "PCE",  "roll_length": None, "stock": 0, "safety_stock": 3000},
    {"id": 17, "name": "Reflective Tape",       "kode": "9006020183",  "category": "Aksesori",  "unit": "ROLL", "roll_length": 1500, "stock": 0, "safety_stock": 20},
    {"id": 18, "name": "Monoskin 0.55 70mm",    "kode": "9006020166",  "category": "Aksesori",  "unit": "ROLL", "roll_length": 70,   "stock": 0, "safety_stock": 50},
]

# (size, model, variant, is_custom) -> [(material_id, qty, unit), ...]
TYRE_SPECS = [
    {
        "size": "65-622-624", "model": "Smart Sam Tube Only",
        "variant": "PERFORMANCE", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (3, 1, "pce"),
            (4, 2, "pce"), (8, 2, "pce"), (11, 2, "pce"), (14, 4, "m"),
        ],
    },
    {
        "size": "57-584-624", "model": "Smart Sam Tube Only",
        "variant": "PERFORMANCE", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (3, 1, "pce"),
            (5, 2, "pce"), (8, 2, "pce"), (11, 2, "pce"), (14, 4, "m"),
        ],
    },
    {
        "size": "57-622-624", "model": "Smart Sam Tube Only",
        "variant": "PERFORMANCE", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (3, 1, "pce"),
            (4, 2, "pce"), (8, 2, "pce"), (11, 2, "pce"), (14, 4, "m"),
        ],
    },
    {
        "size": "54-622-624", "model": "Smart Sam Tube Only",
        "variant": "PERFORMANCE", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (3, 1, "pce"),
            (4, 2, "pce"), (8, 2, "pce"), (11, 2, "pce"), (14, 4, "m"),
        ],
    },
    {
        "size": "57-622-624", "model": "Smart Sam DD GreenGuard",
        "variant": "DD GG", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (17, 4, "m"), (3, 1, "pce"),
            (4, 2, "pce"), (9, 2, "pce"), (12, 2, "pce"), (18, 4, "m"),
        ],
    },
    {
        "size": "54-559-425", "model": "Rapid Rob",
        "variant": "RAPID ROB", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (3, 1, "pce"),
            (6, 2, "pce"), (9, 2, "pce"), (13, 2, "pce"), (15, 4, "m"),
        ],
    },
    {
        "size": "57-559-425", "model": "Rapid Rob",
        "variant": "RAPID ROB", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (3, 1, "pce"),
            (6, 2, "pce"), (9, 2, "pce"), (13, 2, "pce"), (14, 4, "m"),
        ],
    },
    {
        "size": "42-484", "model": "Road Cruiser",
        "variant": "ROAD CRUISER", "is_custom": False,
        "bom": [
            (1, 2, "m"), (2, 2, "m"), (17, 4, "m"), (3, 1, "pce"),
            (7, 2, "pce"), (10, 2, "pce"), (16, 2, "pce"),
        ],
    },
]


class Command(BaseCommand):
    help = 'Reset dan seed ulang semua data master (material, tyre spec, BOM)'

    def handle(self, *args, **options):
        self._clear_all()
        self._seed_users()
        mat_map = self._seed_materials()
        self._seed_tyre_specs(mat_map)
        self.stdout.write(self.style.SUCCESS('\nSeed data selesai.'))
        self.stdout.write(f'  Users    : {User.objects.count()}')
        self.stdout.write(f'  Material : {Material.objects.count()}')
        self.stdout.write(f'  TyreSpec : {TyreSpec.objects.count()}')
        self.stdout.write(f'  BOMItem  : {BOMItem.objects.count()}')

    def _clear_all(self):
        self.stdout.write('Menghapus data lama...')
        DailyUsageEntry.objects.all().delete()
        DailyUsage.objects.all().delete()
        TyreDelivery.objects.all().delete()
        MaterialShipment.objects.all().delete()
        ProductionOrderItem.objects.all().delete()
        ProductionOrder.objects.all().delete()
        StockTransaction.objects.all().delete()
        BOMItem.objects.all().delete()
        TyreSpec.objects.all().delete()
        Material.objects.all().delete()
        self.stdout.write('  [OK] Semua data dihapus')

    def _seed_users(self):
        self.stdout.write('\nMembuat user...')
        USERS = [
            # (username, email, password, is_superuser, is_staff, role)
            ('admin',     'admin@tyre.local',     'admin123',     True,  True,  UserProfile.ROLE_ADMIN),
            ('purchasing','purchasing@tyre.local', 'purchasing123',False, False, UserProfile.ROLE_PURCHASING),
            ('operator',  'operator@tyre.local',  'operator123',  False, False, UserProfile.ROLE_OPERATOR),
            ('viewer',    'viewer@tyre.local',     'viewer123',    False, False, UserProfile.ROLE_VIEWER),
        ]
        for username, email, password, is_superuser, is_staff, role in USERS:
            if User.objects.filter(username=username).exists():
                user = User.objects.get(username=username)
                user.set_password(password)
                user.save()
                self.stdout.write(f'  [=] {username} sudah ada — password direset')
            else:
                user = User.objects.create_user(
                    username=username, email=email, password=password,
                    is_superuser=is_superuser, is_staff=is_staff,
                )
                self.stdout.write(f'  [+] {username} dibuat (role: {role}, password: {password})')
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = role
            profile.save()

    def _seed_materials(self):
        self.stdout.write('\nMenambahkan material...')
        mat_map = {}
        for data in MATERIALS:
            mat_id = data['id']
            mat = Material.objects.create(
                kode=data['kode'],
                name=data['name'],
                category=data.get('category', 'Umum'),
                unit=data['unit'],
                roll_length=data['roll_length'],
                stock=data['stock'],
                safety_stock=data['safety_stock'],
            )
            mat_map[mat_id] = mat
            self.stdout.write(f'  [+] {mat.kode} — {mat.name}')
        return mat_map

    def _seed_tyre_specs(self, mat_map):
        self.stdout.write('\nMenambahkan tyre spec + BOM...')
        for spec_data in TYRE_SPECS:
            spec = TyreSpec.objects.create(
                size=spec_data['size'],
                model=spec_data['model'],
                variant=spec_data['variant'],
                is_custom=spec_data['is_custom'],
            )
            bom_count = 0
            for mat_id, qty, unit in spec_data['bom']:
                mat = mat_map.get(mat_id)
                if mat:
                    BOMItem.objects.create(
                        tyre_spec=spec,
                        material=mat,
                        qty=qty,
                        unit=unit,
                    )
                    bom_count += 1
            self.stdout.write(
                f'  [+] {spec.size} {spec.model} ({spec.variant}) — {bom_count} BOM items'
            )
