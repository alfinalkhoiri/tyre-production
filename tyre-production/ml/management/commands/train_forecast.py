from django.core.management.base import BaseCommand
from ml.data import load_usage_dataframe
from ml.model import train_all, MODEL_DIR


class Command(BaseCommand):
    help = 'Latih model forecasting pemakaian material dari data DailyUsage'

    def add_arguments(self, parser):
        parser.add_argument(
            '--material-id',
            type=int,
            default=None,
            help='Latih hanya untuk material tertentu (default: semua)',
        )

    def handle(self, *args, **options):
        self.stdout.write('Memuat data DailyUsage...')
        df = load_usage_dataframe()

        if df.empty:
            self.stdout.write(self.style.WARNING(
                'Tidak ada data DailyUsage. Isi data terlebih dahulu.'
            ))
            return

        mat_id = options.get('material_id')
        if mat_id:
            df = df[df['material_id'] == mat_id]
            if df.empty:
                self.stdout.write(self.style.ERROR(f'Material ID {mat_id} tidak ditemukan.'))
                return

        n_materials = df['material_id'].nunique()
        n_rows      = len(df)
        self.stdout.write(
            f'Data: {n_rows} entri | {n_materials} material | '
            f'rentang: {df["date"].min().date()} s/d {df["date"].max().date()}'
        )
        self.stdout.write(f'Model disimpan ke: {MODEL_DIR}\n')

        results = train_all(df, verbose=True)

        self.stdout.write('')
        if results:
            self.stdout.write(self.style.SUCCESS(
                f'Training selesai. {len(results)} model disimpan.'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                'Tidak ada model yang dilatih (data terlalu sedikit per material).'
            ))
