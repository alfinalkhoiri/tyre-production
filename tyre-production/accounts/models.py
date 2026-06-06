from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    ROLE_ADMIN = 'admin'
    ROLE_MANAGER = 'manager'
    ROLE_OPERATOR = 'operator'
    ROLE_VIEWER = 'viewer'

    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_MANAGER, 'Manager'),
        (ROLE_OPERATOR, 'Operator'),
        (ROLE_VIEWER, 'Viewer'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_VIEWER)

    def __str__(self):
        return f'{self.user.username} ({self.role})'


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


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

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=64, blank=True)
    object_id = models.CharField(max_length=32, blank=True)
    object_repr = models.CharField(max_length=200, blank=True)
    detail = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['model_name', '-created_at']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        username = self.user.username if self.user else 'system'
        return f'[{self.created_at:%Y-%m-%d %H:%M}] {username} — {self.action} {self.model_name}'
