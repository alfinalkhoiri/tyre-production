from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from drf_spectacular.utils import extend_schema_field
from .models import UserProfile, AuditLog


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'role')
        read_only_fields = ('id', 'is_staff', 'role')

    @extend_schema_field(serializers.CharField())
    def get_role(self, obj) -> str:
        return getattr(getattr(obj, 'profile', None), 'role', 'viewer')


class UserManageSerializer(serializers.ModelSerializer):
    """Admin-only serializer that can update role and is_staff."""
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'role')
        read_only_fields = ('id',)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['role'] = getattr(getattr(instance, 'profile', None), 'role', 'viewer')
        return data

    def update(self, instance, validated_data):
        role = validated_data.pop('role', None)
        instance = super().update(instance, validated_data)
        if role is not None:
            profile, _ = UserProfile.objects.get_or_create(user=instance)
            profile.role = role
            profile.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
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
        user = User.objects.create_user(**validated_data)
        if role == UserProfile.ROLE_ADMIN:
            user.is_staff = True
            user.is_superuser = True
            user.save()
        elif role == UserProfile.ROLE_PURCHASING:
            user.is_staff = True
            user.save()
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.save()
        return user


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', default='—', read_only=True)

    class Meta:
        model = AuditLog
        fields = ('id', 'username', 'action', 'model_name', 'object_id',
                  'object_repr', 'detail', 'ip_address', 'created_at')


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Password lama tidak sesuai.')
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Extends the JWT with role claim and returns user info on login."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = getattr(getattr(user, 'profile', None), 'role', 'viewer')
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
