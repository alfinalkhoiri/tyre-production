from django.contrib.auth.models import User
from rest_framework import generics, status
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
    RegisterSerializer, ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    AuditLogSerializer,
)
from .permissions import IsAdminRole


class LoginRateThrottle(AnonRateThrottle):
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
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
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
            token = RefreshToken(request.data['refresh'])
            token.blacklist()
        except Exception:
            pass
        return Response({'detail': 'Logout berhasil.'}, status=status.HTTP_200_OK)


@extend_schema(summary='Daftarkan user baru (admin only)', tags=['Auth'])
class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [IsAdminRole]

    def perform_create(self, serializer):
        user = serializer.save()
        log(self.request.user, AuditLog.ACTION_CREATE, 'User', user.pk,
            str(user.username), request=self.request,
            detail={'role': getattr(getattr(user, 'profile', None), 'role', '')})


@extend_schema(summary='Profile user yang sedang login', tags=['Auth'])
class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


@extend_schema(
    summary='Ganti password', tags=['Auth'],
    request=ChangePasswordSerializer,
    responses={200: {'type': 'object', 'properties': {'detail': {'type': 'string'}}}},
)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        log(request.user, AuditLog.ACTION_UPDATE, 'User', request.user.pk,
            request.user.username, request=request, detail={'action': 'change_password'})
        return Response({'detail': 'Password berhasil diubah.'})


@extend_schema(summary='List semua user (admin only)', tags=['Auth'])
class UserListView(generics.ListAPIView):
    queryset = User.objects.select_related('profile').order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAdminRole]


@extend_schema(
    summary='Detail, update, atau hapus user (admin only)',
    description='Admin dapat mengubah role, is_staff, dan info profile user lain.',
    tags=['Auth'],
)
class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.select_related('profile').all()
    serializer_class = UserManageSerializer
    permission_classes = [IsAdminRole]

    def perform_update(self, serializer):
        serializer.save()
        log(self.request.user, AuditLog.ACTION_UPDATE, 'User',
            serializer.instance.pk, serializer.instance.username,
            request=self.request)

    def perform_destroy(self, instance):
        log(self.request.user, AuditLog.ACTION_DELETE, 'User',
            instance.pk, instance.username, request=self.request)
        instance.delete()


@extend_schema(
    summary='Riwayat audit log (admin only)',
    description='Log semua aktivitas sistem: login, perubahan order, transaksi stok, dll.',
    tags=['Auth'],
)
class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminRole]
    filterset_fields = ['action', 'model_name', 'user']
    search_fields = ['user__username', 'object_repr', 'model_name']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return AuditLog.objects.select_related('user').all()
