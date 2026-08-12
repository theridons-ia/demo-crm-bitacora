from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import engine
from .ensure_schema import ensure_schema
from .routers import auth, catalog, clients, evidence, receivables, sales, stock, sync, users, visits

settings = get_settings()
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(clients.router)
app.include_router(catalog.router)
app.include_router(stock.router)
app.include_router(visits.router)
app.include_router(sales.router)
app.include_router(receivables.router)
app.include_router(evidence.router)
app.include_router(sync.router)

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.on_event("startup")
def on_startup() -> None:
    ensure_schema(engine)


@app.get("/api/health")
def health():
    return {"ok": True, "app": settings.app_name}


@app.get("/")
def index():
    index_file = FRONTEND_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"message": "Bitácora Campo MVP API", "docs": "/docs"}
