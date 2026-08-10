from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Product, Supplier, User, UserRole
from ..schemas import ProductCreate, ProductOut, SupplierCreate, SupplierOut

router = APIRouter(tags=["catalog"])


@router.get("/api/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Product).filter(Product.is_active.is_(True)).order_by(Product.name).all()


@router.post("/api/products", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.vendedor:
        # MVP: vendedor puede ver, admin/supervisor crear
        from fastapi import HTTPException

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
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Solo supervisor/admin puede crear proveedores")
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier
