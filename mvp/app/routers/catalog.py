from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_supervisor
from ..database import get_db
from ..models import Product, Supplier, User, UserRole
from ..schemas import (
    CatalogVisibilityOut,
    CatalogVisibilityUpdate,
    ProductCreate,
    ProductOut,
    SupplierCreate,
    SupplierOut,
)
from ..services.catalog_visibility import (
    get_visibility,
    set_visibility,
    visible_product_ids_for_seller,
)

router = APIRouter(tags=["catalog"])


@router.get("/api/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Product).filter(Product.is_active.is_(True))
    if current_user.role == UserRole.vendedor:
        allowed = visible_product_ids_for_seller(db, current_user.id)
        if allowed is not None:
            if not allowed:
                return []
            query = query.filter(Product.id.in_(allowed))
    return query.order_by(Product.name).all()


@router.post("/api/products", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.vendedor:
        raise HTTPException(status_code=403, detail="Solo supervisor/admin puede crear productos")
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/api/suppliers", response_model=list[SupplierOut])
def list_suppliers(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Supplier).filter(Supplier.is_active.is_(True)).order_by(Supplier.name).all()


@router.post("/api/suppliers", response_model=SupplierOut)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.vendedor:
        raise HTTPException(status_code=403, detail="Solo supervisor/admin puede crear proveedores")
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.get("/api/sellers/{seller_id}/catalog-visibility", response_model=CatalogVisibilityOut)
def read_catalog_visibility(
    seller_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    unrestricted, product_ids = get_visibility(db, seller_id)
    seller = db.query(User).filter(User.id == seller_id, User.role == UserRole.vendedor).first()
    if not seller:
        raise HTTPException(status_code=404, detail="Vendedor no encontrado")
    return CatalogVisibilityOut(
        seller_id=seller_id,
        unrestricted=unrestricted,
        product_ids=product_ids,
    )


@router.put("/api/sellers/{seller_id}/catalog-visibility", response_model=CatalogVisibilityOut)
def update_catalog_visibility(
    seller_id: int,
    payload: CatalogVisibilityUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supervisor),
):
    unrestricted, product_ids = set_visibility(
        db,
        seller_id=seller_id,
        unrestricted=payload.unrestricted,
        product_ids=payload.product_ids,
    )
    return CatalogVisibilityOut(
        seller_id=seller_id,
        unrestricted=unrestricted,
        product_ids=product_ids,
    )
