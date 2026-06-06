from rest_framework.permissions import BasePermission, SAFE_METHODS


def get_role(user):
    """Return the role string for a user, or None if unauthenticated."""
    if not user or not user.is_authenticated:
        return None
    return getattr(getattr(user, 'profile', None), 'role', 'viewer')


class IsAdminRole(BasePermission):
    """Only users with admin role."""
    message = 'Hanya admin yang dapat mengakses fitur ini.'

    def has_permission(self, request, view):
        return get_role(request.user) == 'admin'


class IsAdminOrManager(BasePermission):
    """Admin or manager role."""
    message = 'Hanya admin atau manager yang dapat mengakses fitur ini.'

    def has_permission(self, request, view):
        return get_role(request.user) in ('admin', 'manager')


class IsAdminOrManagerOrOperator(BasePermission):
    """Admin, manager, or operator role."""
    message = 'Hanya admin, manager, atau operator yang dapat mengakses fitur ini.'

    def has_permission(self, request, view):
        return get_role(request.user) in ('admin', 'manager', 'operator')


class SpecificationWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin or manager."""
    message = 'Hanya admin atau manager yang dapat mengubah data ini.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'manager')


class InventoryWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin or manager."""
    message = 'Hanya admin atau manager yang dapat mengubah transaksi stok.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'manager')


class ProductionOrderWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin or manager."""
    message = 'Hanya admin atau manager yang dapat mengubah production order.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'manager')


class DailyUsageWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin, manager, or operator."""
    message = 'Hanya admin, manager, atau operator yang dapat mengubah daily usage.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'manager', 'operator')
