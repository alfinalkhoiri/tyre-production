from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('production', '0002_add_shipment_delivery_statuses'),
    ]

    operations = [
        migrations.AddField(
            model_name='materialshipment',
            name='confirmed',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='materialshipment',
            name='confirmed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
