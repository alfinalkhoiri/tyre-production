from rest_framework.permissions import BasePermission, SAFE_METHODS

# Permission class DRF = "penjaga pintu" yang dicek SEBELUM sebuah view/action
# dijalankan. `has_permission()` mengembalikan True (boleh lanjut) atau False
# (langsung ditolak, response 403). Semua permission class di file ini
# ujung-ujungnya bertumpu pada get_role() di bawah, yang membaca
# UserProfile.role (lihat accounts/models.py).


def get_role(user):
    """Return the role string for a user, or None if unauthenticated."""
    if not user or not user.is_authenticated:
        return None
    # getattr berantai dengan default: kalau `user.profile` entah kenapa tidak
    # ada, dianggap 'viewer' (role paling terbatas) — supaya gagal secara aman
    # (fail-safe) alih-alih error atau malah dikasih akses penuh.
    return getattr(getattr(user, 'profile', None), 'role', 'viewer')


class IsAdminRole(BasePermission):
    """Only users with admin role."""
    message = 'Hanya admin yang dapat mengakses fitur ini.'  # ini yang tampil di response 403

    def has_permission(self, request, view):
        return get_role(request.user) == 'admin'


class IsAdminOrPurchasing(BasePermission):
    """Admin or purchasing role."""
    message = 'Hanya admin atau admin purchasing yang dapat mengakses fitur ini.'

    def has_permission(self, request, view):
        return get_role(request.user) in ('admin', 'purchasing')


class IsAdminOrPurchasingOrOperator(BasePermission):
    """Admin, purchasing, or operator role."""
    message = 'Hanya admin, admin purchasing, atau operator yang dapat mengakses fitur ini.'

    def has_permission(self, request, view):
        return get_role(request.user) in ('admin', 'purchasing', 'operator')


# Empat class di bawah ini polanya SAMA PERSIS: "siapapun yang sudah login
# boleh BACA (GET/HEAD/OPTIONS, dicek lewat SAFE_METHODS bawaan DRF), tapi
# cuma role tertentu yang boleh MENULIS (POST/PUT/PATCH/DELETE)." Ini pola
# umum untuk halaman yang perlu dilihat semua orang tapi cuma sebagian yang
# boleh mengubah — beda dari IsAdminRole dkk di atas yang blokir total
# berdasarkan role, tanpa peduli method HTTP-nya.

class SpecificationWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin or purchasing."""
    message = 'Hanya admin atau admin purchasing yang dapat mengubah data ini.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'purchasing')


class InventoryWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin or purchasing."""
    message = 'Hanya admin atau admin purchasing yang dapat mengubah transaksi stok.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'purchasing')


class ProductionOrderWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin or purchasing."""
    message = 'Hanya admin atau admin purchasing yang dapat mengubah production order.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'purchasing')


class DailyUsageWritePermission(BasePermission):
    """Read: any authenticated user. Write: admin, purchasing, or operator."""
    message = 'Hanya admin, admin purchasing, atau operator yang dapat mengubah daily usage.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return get_role(request.user) in ('admin', 'purchasing', 'operator')
