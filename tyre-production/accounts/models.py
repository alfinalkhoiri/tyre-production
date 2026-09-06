from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver

# ═══════════════════════════════════════════════════════════════════════════
# ALUR "USER & ROLE" (dipakai fitur Kelola User)
#
# Django punya tabel bawaan `auth_user` (username, password, email, is_staff,
# is_superuser, dll) — tapi TIDAK punya konsep "role" (admin/purchasing/
# operator/viewer) bawaan. Makanya app ini menambahkan UserProfile: tabel
# terpisah yang nempel 1-ke-1 ke setiap User, isinya cuma field `role`.
#
# Kenapa dipisah, bukan nambah kolom langsung ke tabel User? Karena `auth_user`
# adalah tabel bawaan Django (dipakai juga oleh sistem login/permission
# internal Django) — menambah tabel baru yang "menempel" jauh lebih aman &
# rapi daripada mengutak-atik struktur tabel inti framework.
#
# `role` inilah yang dipakai di seluruh app untuk cek hak akses (lihat
# accounts/permissions.py: fungsi get_role() membaca field ini).
# ═══════════════════════════════════════════════════════════════════════════


class UserProfile(models.Model):
    ROLE_ADMIN = 'admin'
    ROLE_PURCHASING = 'purchasing'
    ROLE_OPERATOR = 'operator'
    ROLE_VIEWER = 'viewer'

    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_PURCHASING, 'Admin Purchasing'),
        (ROLE_OPERATOR, 'Operator Gudang'),
        (ROLE_VIEWER, 'Manajemen'),
    ]

    # OneToOneField = tiap User punya TEPAT SATU UserProfile (beda dari
    # ForeignKey yang membolehkan banyak-ke-satu). `related_name='profile'`
    # artinya dari objek user bisa diakses lewat `user.profile.role`.
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_VIEWER)

    def __str__(self):
        return f'{self.user.username} ({self.role})'


# Signal ini yang menjamin SETIAP User baru (dibuat lewat RegisterView atau
# lewat manage.py createsuperuser, dsb) otomatis dapat UserProfile — supaya
# tidak pernah ada User "yatim" tanpa role (yang bisa bikin `user.profile`
# error karena baris UserProfile-nya belum ada).
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


# ── Audit Log ──────────────────────────────────────────────────────────────
# Tabel "jejak audit": setiap aksi penting (login, ubah status order, buat/
# hapus user, dll) dicatat satu baris di sini lewat helper log() di
# accounts/audit.py. Ditampilkan apa adanya di halaman Audit Log (admin only).

class AuditLog(models.Model):
    ACTION_LOGIN = 'LOGIN'
    ACTION_LOGOUT = 'LOGOUT'
    ACTION_CREATE = 'CREATE'
    ACTION_UPDATE = 'UPDATE'
    ACTION_DELETE = 'DELETE'
    ACTION_STATUS = 'STATUS_CHANGE'

    ACTION_CHOICES = [
        (ACTION_LOGIN, 'Login'),
        (ACTION_LOGOUT, 'Logout'),
        (ACTION_CREATE, 'Buat'),
        (ACTION_UPDATE, 'Ubah'),
        (ACTION_DELETE, 'Hapus'),
        (ACTION_STATUS, 'Ubah Status'),
    ]

    # on_delete=SET_NULL (bukan CASCADE): kalau user-nya dihapus, baris audit
    # log TETAP disimpan (cuma `user` jadi kosong/null) — supaya riwayat audit
    # tidak ikut hilang begitu saja hanya karena pelakunya dihapus dari sistem.
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=64, blank=True)   # nama model yang kena aksi, mis. "ProductionOrder"
    object_id = models.CharField(max_length=32, blank=True)    # id objeknya
    object_repr = models.CharField(max_length=200, blank=True) # representasi teks objeknya, mis. nomor order
    detail = models.JSONField(default=dict, blank=True)        # info tambahan bebas bentuk, mis. {'status': 'DONE'}
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']  # terbaru dulu
        # Index mempercepat query yang sering dipakai halaman Audit Log:
        # filter per user, filter per jenis model, atau urut waktu saja.
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['model_name', '-created_at']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        username = self.user.username if self.user else 'system'
        return f'[{self.created_at:%Y-%m-%d %H:%M}] {username} — {self.action} {self.model_name}'
