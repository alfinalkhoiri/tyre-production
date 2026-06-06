import factory
import factory.fuzzy
from decimal import Decimal
from django.contrib.auth.models import User
from factory.django import DjangoModelFactory
from faker import Faker

from specification.models import Material, TyreSpec, BOMItem
from inventory.models import StockTransaction
from production.models import ProductionOrder, ProductionOrderItem, DailyUsage, DailyUsageEntry

fake = Faker('id_ID')


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f'user{n}')
    email    = factory.LazyAttribute(lambda o: f'{o.username}@tyre.local')
    password = factory.PostGenerationMethodCall('set_password', 'testpass123')


class MaterialFactory(DjangoModelFactory):
    class Meta:
        model = Material

    kode         = factory.Sequence(lambda n: f'MAT-{n:03d}')
    name         = factory.LazyAttribute(lambda o: f'Material {o.kode}')
    unit         = 'kg'
    roll_length  = factory.fuzzy.FuzzyDecimal(10, 500, 2)
    stock        = factory.fuzzy.FuzzyDecimal(100, 1000, 2)
    safety_stock = factory.LazyAttribute(lambda o: round(float(o.stock) * 0.2, 2))


class TyreSpecFactory(DjangoModelFactory):
    class Meta:
        model = TyreSpec

    size    = factory.Iterator(['185/65R15', '195/65R15', '205/55R16', '215/60R16'])
    model   = factory.Iterator(['EcoContact', 'SportContact', 'AllSeason'])
    variant = factory.Sequence(lambda n: f'V{n}')
    is_custom = False


class BOMItemFactory(DjangoModelFactory):
    class Meta:
        model = BOMItem

    tyre_spec = factory.SubFactory(TyreSpecFactory)
    material  = factory.SubFactory(MaterialFactory)
    qty       = factory.Faker('pydecimal', left_digits=2, right_digits=4, positive=True)
    unit      = 'kg'


class ProductionOrderFactory(DjangoModelFactory):
    class Meta:
        model = ProductionOrder

    number = factory.Sequence(lambda n: f'PO-2026-{n:04d}')
    date   = factory.Faker('date_object')
    shift  = factory.Iterator(['1', '2', '3'])
    pic    = factory.Faker('name', locale='id_ID')
    status = ProductionOrder.STATUS_DRAFT


class DailyUsageFactory(DjangoModelFactory):
    class Meta:
        model = DailyUsage

    date  = factory.Faker('date_object')
    shift = factory.Iterator(['1', '2', '3'])
    order = factory.SubFactory(ProductionOrderFactory)
    note  = ''


class DailyUsageEntryFactory(DjangoModelFactory):
    class Meta:
        model = DailyUsageEntry

    daily_usage = factory.SubFactory(DailyUsageFactory)
    material    = factory.SubFactory(MaterialFactory)
    qty         = factory.Faker('pydecimal', left_digits=2, right_digits=2, positive=True)
