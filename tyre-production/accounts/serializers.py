from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from drf_spectacular.utils import extend_schema_field
from .models import UserProfile, AuditLog

# Beberapa serializer di sini menangani field `role`, padahal `role` BUKAN
# kolom di tabel User (auth_user) — dia tersimpan di UserProfile yang terpisah
# (lihat accounts/models.py). Makanya tiap serializer yang perlu menampilkan/
# menerima `role` harus menjembatani manual (SerializerMethodField untuk
# baca, override update()/create() untuk tulis) — tidak bisa otomatis seperti
# field biasa dari Meta.fields.


class UserSerializer(serializers.ModelSerializer):
    # SerializerMethodField = field "hitungan", nilainya diambil dari method
    # get_<nama_field> di bawah, bukan langsung dari atribut objek User.
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'role')
        read_only_fields = ('id', 'is_staff', 'role')  # dipakai untuk profil sendiri (MeView) — tidak boleh ganti role sendiri lewat sini

    @extend_schema_field(serializers.CharField())  # cuma buat dokumentasi API (drf-spectacular), tidak pengaruh ke logika
    def get_role(self, obj) -> str:
        return getattr(getattr(obj, 'profile', None), 'role', 'viewer')


class UserManageSerializer(serializers.ModelSerializer):
    """Admin-only serializer that can update role and is_staff."""
    # Beda dari UserSerializer.role (read-only): di sini role BOLEH ditulis,
    # makanya pakai ChoiceField biasa (bisa nerima input), bukan
    # SerializerMethodField (yang selalu read-only). Dipakai UsersPage.tsx
    # untuk ubah role user lain lewat PATCH /auth/users/<id>/.
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'role')
        read_only_fields = ('id',)

    def to_representation(self, instance):
        # Dipanggil setiap kali serializer ini mengubah objek User jadi JSON
        # (baik untuk GET maupun response setelah PATCH). Karena `role` bukan
        # field asli User, nilainya harus "disuntik" manual di sini dari
        # instance.profile.role — bukan otomatis lewat Meta.fields biasa.
        data = super().to_representation(instance)
        data['role'] = getattr(getattr(instance, 'profile', None), 'role', 'viewer')
        return data

    def update(self, instance, validated_data):
        # `role` dikeluarkan dulu dari validated_data sebelum diteruskan ke
        # super().update() — karena super().update() cuma tahu cara nulis ke
        # field asli model User (username, email, dst), TIDAK tahu soal
        # UserProfile. Jadi role-nya ditangani manual di baris-baris berikutnya.
        role = validated_data.pop('role', None)
        instance = super().update(instance, validated_data)
        if role is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            profile.role = role
            profile.save()
            instance.profile = profile  # buang cache relasi lama supaya to_representation tidak stale
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    # write_only=True = field ini diterima saat INPUT (dikirim client) tapi
    # tidak pernah dikirim balik di response (supaya password tidak pernah
    # ikut "bocor" ke response JSON, sekalipun sudah di-hash).
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(
        choices=UserProfile.ROLE_CHOICES,
        default=UserProfile.ROLE_VIEWER,
        write_only=True,
        required=False,
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'first_name', 'last_name', 'role')

    def create(self, validated_data):
        role = validated_data.pop('role', UserProfile.ROLE_VIEWER)
        # create_user() (bukan User(...).save() biasa) otomatis meng-hash
        # password dengan algoritma aman Django — jangan pernah simpan
        # password mentah/plain text ke database.
        user = User.objects.create_user(**validated_data)
        # is_staff/is_superuser adalah flag bawaan Django (dipakai untuk akses
        # /admin/ Django dan bypass permission check) — diselaraskan otomatis
        # sesuai role yang dipilih, supaya admin/purchasing juga bisa masuk
        # Django admin panel kalau perlu.
        if role == UserProfile.ROLE_ADMIN:
            user.is_staff = True
            user.is_superuser = True
            user.save()
        elif role == UserProfile.ROLE_PURCHASING:
            user.is_staff = True
            user.save()
        # UserProfile untuk user ini sebenarnya sudah otomatis dibuat oleh
        # signal create_user_profile() (accounts/models.py) begitu create_user()
        # di atas jalan — get_or_create() di sini cuma untuk PASTIKAN ada,
        # lalu set role-nya sesuai pilihan (signal selalu bikin default 'viewer').
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save()
        return user


class AuditLogSerializer(serializers.ModelSerializer):
    # source='user.username' = ambil nilai dari relasi (bukan field langsung
    # di model AuditLog) — cara DRF membaca field lewat "titik" ke objek terkait.
    username = serializers.CharField(source='user.username', default='—', read_only=True)

    class Meta:
        model = AuditLog
        fields = ('id', 'username', 'action', 'model_name', 'object_id',
                  'object_repr', 'detail', 'ip_address', 'created_at')


class ChangePasswordSerializer(serializers.Serializer):
    """Ganti password DIRI SENDIRI — dipakai halaman profil (kalau ada) via
    ChangePasswordView. Beda dengan AdminSetPasswordSerializer di bawah:
    di sini WAJIB tahu password lama, karena user mengganti passwordnya sendiri."""
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        # validate_<field> = hook DRF yang otomatis dipanggil untuk validasi
        # SATU field tertentu. `self.context['request']` dikirim manual dari
        # view (ChangePasswordView) supaya tahu siapa user yang sedang login.
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Password lama tidak sesuai.')
        return value


class AdminSetPasswordSerializer(serializers.Serializer):
    """Admin mengatur ulang password user lain, tanpa perlu tahu password lama."""
    new_password = serializers.CharField(write_only=True, min_length=8)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extends the JWT with role claim and returns user info on login."""

    @classmethod
    def get_token(cls, user):
        # Menambahkan klaim `role` ke DALAM token JWT itu sendiri (bukan cuma
        # di response login) — supaya kalau nanti dibutuhkan, role bisa dibaca
        # langsung dari token tanpa query database lagi. (Catatan: permission
        # check di accounts/permissions.py tetap query database tiap request,
        # BUKAN baca dari klaim token ini — jadi kalau role berubah di tengah
        # sesi, perubahan langsung berlaku tanpa perlu login ulang.)
        token = super().get_token(user)
        token['role'] = getattr(getattr(user, 'profile', None), 'role', 'viewer')
        return token

    def validate(self, attrs):
        # Response standar SimpleJWT cuma berisi {access, refresh}. Di-extend
        # di sini supaya response login JUGA membawa data user lengkap
        # (termasuk role) — jadi frontend tidak perlu request kedua ke /me/
        # cuma untuk tahu siapa yang baru login (lihat AuthContext.tsx: login()).
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
