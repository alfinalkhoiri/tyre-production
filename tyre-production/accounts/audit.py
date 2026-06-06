"""Utility helpers for writing AuditLog entries."""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest


def get_client_ip(request) -> str | None:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log(
    user,
    action: str,
    model_name: str = '',
    object_id=None,
    object_repr: str = '',
    detail: dict | None = None,
    request=None,
) -> None:
    """Write one AuditLog row. Never raises — failures are silently ignored."""
    try:
        from .models import AuditLog
        AuditLog.objects.create(
            user=user,
            action=action,
            model_name=model_name,
            object_id=str(object_id) if object_id is not None else '',
            object_repr=object_repr[:200],
            detail=detail or {},
            ip_address=get_client_ip(request) if request else None,
        )
    except Exception:
        pass
