import httpx
import math
from models import Property, DistanceOverride, Location
from typing import List, Dict, Optional
from datetime import datetime

def get_dubai_traffic_multiplier(time_mins: int, date_str: Optional[str] = None) -> float:
    # time_mins is the minute of the day (0-1440)
    hour = time_mins / 60.0
    
    # Base multiplier (Dubai traffic is generally heavy, OSRM is often optimistic)
    # Using 1.5 as baseline because the expert dispatcher consistently allocates minimum 30-min driving blocks
    mult = 1.5
    
    # Morning Rush Hour (7:30 AM - 9:30 AM)
    if 7.5 <= hour <= 9.5:
        mult = 2.0
        
    # Evening Rush Hour (5:00 PM - 8:00 PM)
    elif 17.0 <= hour <= 20.0:
        mult = 2.2
        
    # Mid-day mini rush (1:30 PM - 3:00 PM)
    elif 13.5 <= hour <= 15.0:
        mult = 1.5
        
    # Month/Day adjustments (simplified: assuming today if no date, or just fixed for now)
    # Could parse date_str to check for weekends (Sat/Sun) or summer months.
    if date_str:
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            # Weekend (Saturday=5, Sunday=6)
            if dt.weekday() >= 5:
                # Less morning rush, more evening/night traffic
                if 7.5 <= hour <= 9.5:
                    mult = 1.1 # No morning rush
                elif 17.0 <= hour <= 22.0:
                    mult = 1.8 # Extended evening traffic
                    
            # Summer months (June, July, August)
            if dt.month in [6, 7, 8]:
                mult *= 0.85 # Less traffic due to school holidays/expats leaving
        except:
            pass
            
    return mult
OSRM_BASE_URL = "http://router.project-osrm.org/table/v1/driving/"

def haversine(lat1, lon1, lat2, lon2):
    # Fallback distance in meters
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

async def get_distance_matrix(properties: List[Property], overrides: List[DistanceOverride], hq: Optional[Location] = None) -> Dict[str, Dict[str, int]]:
    # Map property ID to its index in the request
    # If HQ is provided, we treat it as an extra node with id "hq"
    prop_list = list(properties)
    
    # We will build a unified list of points to query OSRM
    # HQ is added at the end if it exists
    points = [{"id": p.id, "lat": p.latitude, "lon": p.longitude} for p in prop_list]
    if hq:
        points.append({"id": "hq", "lat": hq.latitude, "lon": hq.longitude})
        
    coords = ";".join([f"{pt['lon']},{pt['lat']}" for pt in points])
    
    matrix = {}
    for pt in points:
        matrix[pt["id"]] = {}
        for pt2 in points:
            matrix[pt["id"]][pt2["id"]] = 0 # default duration 0
    
    if len(points) < 2:
        return matrix
        
    try:
        url = f"{OSRM_BASE_URL}{coords}?annotations=duration"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                durations = data.get("durations", [])
                for i, pt1 in enumerate(points):
                    for j, pt2 in enumerate(points):
                        # OSRM returns duration in seconds. Convert to minutes.
                        # Handle null values by using a fallback
                        duration_sec = durations[i][j]
                        if duration_sec is None:
                            # 50km/h average speed fallback
                            dist = haversine(pt1["lat"], pt1["lon"], pt2["lat"], pt2["lon"])
                            duration_mins = int((dist / 50000) * 60)
                        else:
                            duration_mins = int(duration_sec / 60)
                        matrix[pt1["id"]][pt2["id"]] = duration_mins
    except Exception as e:
        print(f"Failed to fetch OSRM data, using fallback: {e}")
        for pt1 in points:
            for pt2 in points:
                dist = haversine(pt1["lat"], pt1["lon"], pt2["lat"], pt2["lon"])
                matrix[pt1["id"]][pt2["id"]] = int((dist / 50000) * 60)
                
    # Apply manual overrides (overrides only apply between properties, not HQ)
    for override in overrides:
        if override.from_property_id in matrix and override.to_property_id in matrix[override.from_property_id]:
            matrix[override.from_property_id][override.to_property_id] = override.duration_mins
            
    return matrix
