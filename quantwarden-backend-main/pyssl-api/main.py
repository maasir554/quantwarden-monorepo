from fastapi import FastAPI, HTTPException, status
from pydantic import ValidationError
import socket
import ssl

from models import DomainRequest, SSLAnalysisResponse
from ssl_utils import analyze_ssl

app = FastAPI(
    title="SSL Analysis API",
    description="Extracts and analyzes SSL/TLS certificate details for a given domain.",
    version="1.0.0"
)

@app.post("/api/v1/ssl-analysis", response_model=SSLAnalysisResponse, status_code=status.HTTP_200_OK)
def extract_ssl_details(request: DomainRequest):
    """
    Analyzes the SSL/TLS certificate for a requested domain name.
    """
    domain = request.domain.strip()
    
    # Very basic validation to prevent strange formatting throwing unexpected errors
    if not domain or "://" in domain:
         raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail="Please provide a valid domain name (e.g., example.com) without protocol scheme."
         )
         
    try:
        response = analyze_ssl(domain)
        return response
    
    except socket.timeout:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The connection request to the domain timed out."
        )
    except socket.gaierror as e:
        raise HTTPException(
             status_code=status.HTTP_400_BAD_REQUEST,
             detail=f"Failed to resolve domain: {str(e)}"
        )
    except ssl.SSLError as e:
         raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail=f"SSL negotiation failed: {str(e)}"
         )
    except Exception as e:
        raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail=f"An unexpected error occurred during analysis: {str(e)}"
        )
