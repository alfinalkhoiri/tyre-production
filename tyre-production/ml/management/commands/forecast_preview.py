from django.core.management.base import BaseCommand
from ml.forecast import estimate_all, DEFAULT_HORIZON


class Command(BaseCommand):
    help = 'Tampilkan estimasi kebutuhan material berdasarkan ADC (tanpa training)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--horizon', type=int, default=DEFAULT_HORIZON,
            help=f'Horizon proyeksi dalam hari (default: {DEFAULT_HORIZON})',
        )

    def handle(self, *args, **options):
        horizon = options['horizon']
        self.stdout.write(f'Estimasi kebutuhan material — horizon: {horizon} hari\n')

        results = estimate_all(horizon=horizon)
        if not results:
            self.stdout.write(self.style.WARNING('Tidak ada material.'))
            return

        header = f"{'Kode':<12} {'Nama':<30} {'ADC':>8} {'Stok':>10} {'Sisa Hari':>10} {'Status':<12} {'Saran Pesan':>12}"
        self.stdout.write(header)
        self.stdout.write('-' * len(header))

        for r in results:
            days = f"{r['days_remaining']:.1f}" if r['days_remaining'] is not None else '—'
            line = (
                f"{r['kode']:<12} {r['name'][:29]:<30} "
                f"{r['adc']:>8.2f} {r['current_stock']:>10.2f} "
                f"{days:>10} {r['status']:<12} {r['suggested_order']:>12.2f}"
            )
            if r['status'] == 'perlu_pesan':
                self.stdout.write(self.style.ERROR(line))
            else:
                self.stdout.write(line)

        perlu = sum(1 for r in results if r['status'] == 'perlu_pesan')
        self.stdout.write(f'\n{len(results)} material · {perlu} perlu pesan.')
