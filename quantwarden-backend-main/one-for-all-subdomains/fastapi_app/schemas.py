from pydantic import BaseModel, Field


class ScanRequest(BaseModel):
    domain: str = Field(..., min_length=1, description="Input domain to enumerate")


class ScanResponse(BaseModel):
    domain: str
    count: int
    subdomains: list[str]
