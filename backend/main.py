from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import SchedulerRequest
from scheduler import solve_schedule
from pydantic import BaseModel
import requests as req

app = FastAPI(title="Holiday Home Scheduler API")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/schedule")
async def generate_schedule(request: SchedulerRequest):
    try:
        result = await solve_schedule(request)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

class ResolveMapsRequest(BaseModel):
    url: str

@app.post("/api/resolve-maps")
def resolve_maps(body: ResolveMapsRequest):
    """Follow redirects on a shortened Google Maps URL and return the final expanded URL."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        r = req.get(body.url, headers=headers, allow_redirects=True, timeout=8)
        return {"resolved_url": r.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not resolve URL: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
