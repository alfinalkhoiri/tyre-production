from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiExample
from .audit import log
from .models import AuditLog
from .serializers import (
    UserSerializer, UserManageSerializer,
    RegisterSerializer, ChangePasswordSerializer, AdminSetPasswordSerializer,
    CustomTokenObtainPairSerializer,
    AuditLogSerializer,
)
from .permissions import IsAdminRole

# Catatan gaya kode: file ini pakai "generic views" DRF (CreateAPIView,
# ListAPIView, RetrieveUpdateAPIView, dst) — beda dari production/views.py
# yang pakai ModelViewSet + @action. Generic view = satu class biasanya cuma
# menangani SATU jenis operasi (list saja, atau create saja, dst), jadi lebih
# terasa "1 endpoint = 1 class" — cocok untuk endpoint auth yang sifatnya
# beragam (login, logout, ganti password, dst), bukan CRUD 1 resource penuh.
# `@extend_schema` di atas tiap class cuma untuk dokumentasi Swagger/Redoc
# (/api/docs/) — tidak mempengaruhi logika sama sekali.


class LoginRateThrottle(AnonRateThrottle):
    # Membatasi percobaan login jadi maks 10x/menit per alamat IP — pertahanan
    # dasar terhadap brute-force menebak password.
    scope = 'login'
    rate = '10/minute'


@extend_schema(
    summary='Login — dapatkan access & refresh token',
    description='Kirim `username` dan `password`. Response menyertakan token dan info user beserta role.',
    tags=['Auth'],
    examples=[
        OpenApiExample('Contoh login', value={'username': 'admin', 'password': 'admin1234'},
                       request_only=True),
    ],
)
class LoginView(TokenObtainPairView):
    # TokenObtainPairView (bawaan djangorestframework-simplejwt) sudah
    # menangani cek username+password lalu menerbitkan sepasang token JWT:
    # `access` (umur pendek, dikirim di header Authorization tiap request) dan
    # `refresh` (umur panjang, dipakai untuk minta access token baru tanpa
    # login ulang — lihat TokenRefreshView di bawah).
    permission_classes = [AllowAny]  # justru harus BOLEH diakses tanpa login (belum ada token)
    throttle_classes = [LoginRateThrottle]
    serializer_class = CustomTokenObtainPairSerializer  # versi custom yang menambahkan `role` + data user (lihat serializers.py)

    def post(self, request, *args, **kwargs):
        # Override post() cuma untuk "menyisipkan" pencatatan audit log SETELAH
        # login berhasil — logika autentikasi sesungguhnya tetap dari parent
        # class (super().post()), tidak ditulis ulang di sini.
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get('username', '')
            try:
                user = User.objects.get(username=username)
                log(user, AuditLog.ACTION_LOGIN, request=request,
                    detail={'username': username})
            except User.DoesNotExist:
                pass
        return response


@extend_schema(summary='Perbarui access token menggunakan refresh token', tags=['Auth'])
class TokenRefreshView(BaseTokenRefreshView):
    # Dipanggil otomatis oleh frontend (lihat api/client.ts, interceptor 401)
    # setiap kali access token kedaluwarsa — supaya user tidak perlu login
    # ulang manual selama refresh token-nya masih berlaku.
    permission_classes = [AllowAny]


@extend_schema(
    summary='Logout — blacklist refresh token',
    description='Kirim `refresh` token di body.',
    tags=['Auth'],
    request={'application/json': {'type': 'object', 'properties': {'refresh': {'type': 'string'}}}},
    responses={200: {'type': 'object', 'properties': {'detail': {'type': 'string'}}}},
)
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        log(request.user, AuditLog.ACTION_LOGOUT, request=request)
        try:
            # "Blacklist" refresh token ini supaya tidak bisa dipakai lagi
            # untuk minta access token baru — inilah cara JWT "logout" secara
            # efektif (JWT sendiri tidak bisa "dicabut" begitu diterbitkan,
            # makanya butuh daftar hitam/blacklist terpisah di database).
            token = RefreshToken(request.data['refresh'])
            token.blacklist()
        except Exception:
            pass  # token sudah tidak valid/kadaluwarsa pun tidak masalah — tujuan akhirnya (logout) tetap tercapai
        return Response({'detail': 'Logout berhasil.'}, status=status.HTTP_200_OK)


@extend_schema(summary='Daftarkan user baru (admin only)', tags=['Auth'])
class RegisterView(generics.CreateAPIView):
    # CreateAPIView = generic view yang otomatis menangani POST untuk bikin
    # objek baru dari serializer_class di bawah. Dipakai fitur "Tambah User"
    # di halaman Kelola User — meski namanya "Register", ini BUKAN pendaftaran
    # akun sendiri (self sign-up), tapi admin yang membuatkan akun untuk orang lain.
    serializer_class = RegisterSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        # Hook yang dipanggil generic view TEPAT SEBELUM objek disimpan —
        # override di sini untuk menyisipkan pencatatan audit log setelah
        # user baru berhasil dibuat.
        user = serializer.save()
        log(self.request.user, AuditLog.ACTION_CREATE, 'User', user.pk,
            str(user.username), request=self.request,
            detail={'role': getattr(getattr(user, 'profile', None), 'role', '')})


@extend_schema(summary='Profile user yang sedang login', tags=['Auth'])
class MeView(generics.RetrieveUpdateAPIView):
    # GET untuk lihat profil sendiri, PATCH/PUT untuk edit nama/email sendiri
    # (role & is_staff SENGAJA read_only di UserSerializer — tidak bisa
    # ganti role sendiri lewat endpoint ini).
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # Biasanya generic view RetrieveUpdateAPIView mengambil objek dari
        # <pk> di URL — di sini di-override supaya SELALU mengembalikan user
        # yang sedang login (dari token), bukan dari parameter URL manapun.
        return self.request.user


@extend_schema(
    summary='Ganti password', tags=['Auth'],
    request=ChangePasswordSerializer,
    responses={200: {'type': 'object', 'properties': {'detail': {'type': 'string'}}}},
)
class ChangePasswordView(APIView):
    # Pakai APIView polos (bukan generic view) karena aksinya bukan
    # create/update objek biasa — perlu logika khusus: cek password lama dulu.
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)  # ini juga yang memicu validate_old_password() di serializer
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        log(request.user, AuditLog.ACTION_UPDATE, 'User', request.user.pk,
            request.user.username, request=request, detail={'action': 'change_password'})
        return Response({'detail': 'Password berhasil diubah.'})


@extend_schema(summary='List semua user (admin only)', tags=['Auth'])
class UserListView(generics.ListAPIView):
    # ListAPIView = GET saja, otomatis dipaginasi sesuai setting global DRF
    # (lihat config/settings/base.py: DEFAULT_PAGINATION_CLASS, PAGE_SIZE=20).
    # Ini yang dipanggil UsersPage.tsx (getUsers()) untuk isi tabel Kelola User.
    queryset = User.objects.select_related('profile').order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]


@extend_schema(
    summary='Detail, update, atau hapus user (admin only)',
    description='Admin dapat mengubah role, is_staff, dan info profile user lain.',
    tags=['Auth'],
)
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Satu class ini otomatis menangani 3 method sekaligus untuk 1 user
    # tertentu (dari <pk> di URL): GET (lihat detail), PATCH/PUT (ubah), DELETE
    # (hapus) — makanya namanya "RetrieveUpdateDestroy".
    queryset = User.objects.select_related('profile').all()
    serializer_class = UserManageSerializer
    permission_classes = [IsAdminRole]

    def perform_update(self, serializer):
        # Guard anti-kunci-diri-sendiri: kalau admin yang sedang login coba
        # mengubah ROLE AKUN SENDIRI menjadi bukan admin, tolak — supaya tidak
        # ada skenario "admin terakhir tanpa sengaja mencabut akses admin-nya
        # sendiri" dan jadi tidak ada yang bisa kelola user lagi.
        new_role = serializer.validated_data.get('role')
        if serializer.instance.pk == self.request.user.pk and new_role and new_role != 'admin':
            raise ValidationError({'detail': 'Tidak bisa mengubah role akun sendiri dari admin.'})
        serializer.save()
        log(self.request.user, AuditLog.ACTION_UPDATE, 'User',
            serializer.instance.pk, serializer.instance.username,
            request=self.request)

    def perform_destroy(self, instance):
        # Guard serupa: admin tidak boleh menghapus akun sendiri (kalau bisa,
        # dan itu satu-satunya admin, sistem jadi tidak punya admin lagi).
        if instance.pk == self.request.user.pk:
            raise ValidationError({'detail': 'Tidak bisa menghapus akun sendiri.'})
        log(self.request.user, AuditLog.ACTION_DELETE, 'User',
            instance.pk, instance.username, request=self.request)
        instance.delete()


@extend_schema(
    summary='Admin mengatur ulang password user lain (admin only)',
    description='Tidak memerlukan password lama, hanya untuk admin.',
    tags=['Auth'],
    request=AdminSetPasswordSerializer,
    responses={200: {'type': 'object', 'properties': {'detail': {'type': 'string'}}}},
)
class AdminSetPasswordView(APIView):
    # Endpoint terpisah dari ChangePasswordView di atas — sengaja dipisah
    # karena aturannya beda total: di sini TIDAK perlu tahu password lama
    # (karena yang mengubah adalah admin, bukan pemilik akunnya sendiri), dan
    # target usernya ditentukan dari `pk` di URL, bukan dari user yang login.
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        # get_object_or_404 = ambil objek dari database, otomatis lempar
        # response 404 (bukan error 500) kalau `pk` yang diminta tidak ada.
        target = generics.get_object_or_404(User, pk=pk)
        serializer = AdminSetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target.set_password(serializer.validated_data['new_password'])
        target.save()
        log(request.user, AuditLog.ACTION_UPDATE, 'User', target.pk,
            target.username, request=request, detail={'action': 'admin_set_password'})
        return Response({'detail': 'Password berhasil diubah.'})


@extend_schema(
    summary='Riwayat audit log (admin only)',
    description='Log semua aktivitas sistem: login, perubahan order, transaksi stok, dll.',
    tags=['Auth'],
)
class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminRole]
    # filterset_fields/search_fields/ordering_fields = fitur bawaan DRF untuk
    # otomatis mendukung query param seperti ?action=LOGIN, ?search=budi,
    # ?ordering=-created_at — tanpa perlu ditulis manual satu-satu.
    filterset_fields = ['action', 'model_name', 'user']
    search_fields = ['user__username', 'object_repr', 'model_name']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return AuditLog.objects.select_related('user').all()
