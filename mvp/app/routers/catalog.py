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
    ProductUpdate,
    SupplierCreate,
    SupplierOut,
)
from ..services.catalog_visibility import (
    get_visibility,
    set_visibility,
    visible_product_ids_for_seller,
)
from ..services.fx import get_today_out
from ..services.product_prices import apply_auto_prices, product_to_out

router = APIRouter(tags=["catalog"])


def _fx_pair(db: Session) -> tuple:
    fx = get_today_out(db)
    if not fx:
        return None, None
    return fx.usd_to_ves, fx.usdt_to_ves


@router.get("/api/products", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Product).filter(Product.is_active.is_(True))
    if current_user.role == UserRole.vendedor:
        allowed = visible_product_ids_for_seller(db, current_user.id)
        if allowed is not None:
            if not allowed:
                return []
            query = query.filter(Product.id.in_(allowed))
    bcv, usdt = _fx_pair(db)
    return [product_to_out(p, bcv=bcv, usdt=usdt) for p in query.order_by(Product.name).all()]


def _normalize_image_url(value: str | None) -> str | None:
    if value is None:
        return None
    url = value.strip()
    if not url:
        return None
    if len(url) > 500_000:
        raise HTTPException(status_code=400, detail="La imagen es demasiado pesada")
    return url


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _sanitize_product_payload(data: dict) -> dict:
    for key in ("brand", "category", "presentation", "barcode", "lot", "notes"):
        if key in data:
            raw = data[key]
            data[key] = _blank_to_none(raw) if isinstance(raw, str) or raw is None else raw
    if "image_url" in data:
        data["image_url"] = _normalize_image_url(data.get("image_url"))
    if "unit" in data and data["unit"] is not None:
        data["unit"] = str(data["unit"]).strip() or "unidad"
    if "pack_units" in data and data["pack_units"] is not None and data["pack_units"] < 1:
        raise HTTPException(status_code=400, detail="Unidades por empaque debe ser al menos 1")
    if "min_stock" in data and data["min_stock"] is not None and data["min_stock"] < 0:
        raise HTTPException(status_code=400, detail="Stock mínimo inválido")
    if "cost_usd" in data and data["cost_usd"] is not None and data["cost_usd"] < 0:
        raise HTTPException(status_code=400, detail="Costo inválido")
    if "price_usd_2" in data and data["price_usd_2"] is not None and data["price_usd_2"] < 0:
        raise HTTPException(status_code=400, detail="Precio 2 inválido")
    if "price_ves" in data and data["price_ves"] is not None and data["price_ves"] < 0:
        raise HTTPException(status_code=400, detail="Precio 3 (Bs) inválido")
    return data


@router.post("/api/products", response_model=ProductOut)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.vendedor:
        raise HTTPException(status_code=403, detail="Solo supervisor/admin puede crear productos")
    sku = payload.sku.strip().upper()
    if not sku or not payload.name.strip():
        raise HTTPException(status_code=400, detail="SKU y nombre son obligatorios")
    if db.query(Product).filter(Product.sku == sku).first():
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese SKU")
    data = _sanitize_product_payload(payload.model_dump())
    data["sku"] = sku
    data["name"] = payload.name.strip()
    data["stock"] = max(0, payload.stock)
    if data.get("min_stock") is None:
        data["min_stock"] = 40
    bcv, usdt = _fx_pair(db)
    apply_auto_prices(data, bcv=bcv, usdt=usdt)
    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product_to_out(product, bcv=bcv, usdt=usdt)


@router.patch("/api/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.vendedor:
        raise HTTPException(status_code=403, detail="Solo supervisor/admin puede editar productos")
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    data = _sanitize_product_payload(payload.model_dump(exclude_unset=True))
    if "name" in data and data["name"] is not None:
        data["name"] = data["name"].strip()
        if not data["name"]:
            raise HTTPException(status_code=400, detail="El nombre no puede quedar vacío")
    for key, value in data.items():
        setattr(product, key, value)
    bcv, usdt = _fx_pair(db)
    snapshot = {
        "price_usd": product.price_usd,
        "price_usd_2": product.price_usd_2,
        "price_ves": product.price_ves,
        "price_usd_auto": product.price_usd_auto,
        "price_usd_2_auto": product.price_usd_2_auto,
        "price_ves_auto": product.price_ves_auto,
    }
    apply_auto_prices(snapshot, bcv=bcv, usdt=usdt)
    product.price_usd = snapshot.get("price_usd")
    product.price_usd_2 = snapshot.get("price_usd_2")
    product.price_ves = snapshot.get("price_ves")
    db.commit()
    db.refresh(product)
    return product_to_out(product, bcv=bcv, usdt=usdt)


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
