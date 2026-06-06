from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('specification', '0002_roll_length_nullable'),
    ]

    operations = [
        migrations.AddField(
            model_name='material',
            name='category',
            field=models.CharField(default='Umum', max_length=100),
        ),
    ]
