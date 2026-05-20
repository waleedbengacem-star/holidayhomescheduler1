from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class Property(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    google_maps_link: Optional[str] = None
    bedrooms: int = 1

class Location(BaseModel):
    name: str
    latitude: float
    longitude: float

class Staff(BaseModel):
    id: str
    name: str
    roles: List[str] # e.g. ["PA", "Cleaner"]
    has_car: bool = False
    start_time_mins: int = 540 # 9:00 AM in mins
    end_time_mins: int = 1020 # 5:00 PM in mins
    max_workload_tasks: int = 10
    is_off_today: bool = False
    is_off_tomorrow: bool = False

class Task(BaseModel):
    id: str
    property_id: str
    task_type: str # "Cleaning", "Check-in", "Cash Collection"
    duration_mins: int
    time_window_start_mins: int
    time_window_end_mins: int
    required_roles: List[str] # e.g. ["Cleaner"] or ["PA", "Cleaner"]
    priority: int = 2 # 1=High, 2=Medium, 3=Low

class DistanceOverride(BaseModel):
    from_property_id: str
    to_property_id: str
    distance_meters: float
    duration_mins: int

class SchedulerRequest(BaseModel):
    properties: List[Property]
    staff: List[Staff]
    tasks: List[Task]
    distance_overrides: Optional[List[DistanceOverride]] = []
    headquarters: Optional[Location] = None
