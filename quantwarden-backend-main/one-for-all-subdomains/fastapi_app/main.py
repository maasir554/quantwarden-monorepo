import asyncio

from fastapi import FastAPI, HTTPException

from fastapi_app.engine import OneForAllScanService, ScanOptions
from fastapi_app.schemas import ScanRequest, ScanResponse

app = FastAPI(
    title="OneForAll Subdomain API",
    version="1.0.0",
    description="FastAPI wrapper around OneForAll core engine",
)

service = OneForAllScanService()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/subdomains", response_model=ScanResponse)
async def enumerate_subdomains(payload: ScanRequest) -> ScanResponse:
    options = ScanOptions()

    try:
        subdomains = await asyncio.to_thread(service.scan, payload.domain, options)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SystemExit as exc:
        raise HTTPException(status_code=500, detail=f"scan aborted: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"scan failed: {exc}") from exc

    return ScanResponse(domain=payload.domain, count=len(subdomains), subdomains=subdomains)
