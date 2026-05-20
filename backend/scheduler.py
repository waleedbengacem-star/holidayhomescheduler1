from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from models import SchedulerRequest
from osrm import get_distance_matrix, get_dubai_traffic_multiplier
from typing import Dict, List, Any

def create_data_model(request: SchedulerRequest, time_matrix: Dict[str, Dict[str, int]]) -> dict:
    data = {}
    
    num_tasks = len(request.tasks)
    num_vehicles = len(request.staff)
    
    data['num_vehicles'] = num_vehicles
    data['depot'] = 0
    data['starts'] = [0] * num_vehicles
    data['ends'] = [0] * num_vehicles
    
    task_idx_to_property_id = {}
    task_idx_to_start_time = {}
    for i, t in enumerate(request.tasks):
        task_idx_to_property_id[i+1] = t.property_id
        task_idx_to_start_time[i+1] = t.time_window_start_mins
        
    n_nodes = num_tasks + 1
    matrix = [[0]*n_nodes for _ in range(n_nodes)]
    
    import math
    LOGISTICS_BUFFER_MINS = 20 # Parking, elevators, security, etc.
    
    for i in range(1, n_nodes):
        prop_id_i = task_idx_to_property_id[i]
        start_mins = task_idx_to_start_time[i]
        mult = get_dubai_traffic_multiplier(start_mins)
        
        for j in range(1, n_nodes):
            if i == j:
                matrix[i][j] = 0
            else:
                prop_id_j = task_idx_to_property_id[j]
                base_time = time_matrix[prop_id_i].get(prop_id_j, 0)
                # Apply multiplier and buffer
                raw_time = (base_time * mult) + LOGISTICS_BUFFER_MINS
                # Snap to next 15-minute interval (Expert style)
                snapped_time = math.ceil(raw_time / 15.0) * 15
                matrix[i][j] = int(snapped_time)
                
    # From HQ to first task
    for i in range(1, n_nodes):
        prop_id = task_idx_to_property_id[i]
        mult_morning = get_dubai_traffic_multiplier(540) # Assume 9 AM departure
        if "hq" in time_matrix:
            base_to = time_matrix["hq"].get(prop_id, 20)
            base_from = time_matrix.get(prop_id, {}).get("hq", 20)
            raw_to = (base_to * mult_morning) + LOGISTICS_BUFFER_MINS
            raw_from = (base_from * 1.5) + LOGISTICS_BUFFER_MINS
            matrix[0][i] = int(math.ceil(raw_to / 15.0) * 15)
            matrix[i][0] = int(math.ceil(raw_from / 15.0) * 15)
        else:
            raw_to = (20 * mult_morning) + LOGISTICS_BUFFER_MINS
            raw_from = (20 * 1.5) + LOGISTICS_BUFFER_MINS
            matrix[0][i] = int(math.ceil(raw_to / 15.0) * 15)
            matrix[i][0] = int(math.ceil(raw_from / 15.0) * 15)
            
    matrix[0][0] = 0
        
    data['time_matrix'] = matrix
    
    data['time_windows'] = [(0, 1440)]
    data['service_time'] = [0]
    
    for t in request.tasks:
        data['time_windows'].append((t.time_window_start_mins, t.time_window_end_mins))
        data['service_time'].append(t.duration_mins)
        
    data['vehicle_time_windows'] = []
    for s in request.staff:
        data['vehicle_time_windows'].append((s.start_time_mins, s.end_time_mins))
        
    data['allowed_vehicles'] = {}
    for i, t in enumerate(request.tasks):
        node = i + 1
        allowed = []
        for v_idx, s in enumerate(request.staff):
            if any(r in t.required_roles for r in s.roles):
                allowed.append(v_idx)
        data['allowed_vehicles'][node] = allowed
        
    return data

def _run_solver(request: SchedulerRequest, target_tasks: list, time_matrix_map: dict) -> dict:
    # Create a sub-request for just the target tasks
    sub_request = SchedulerRequest(
        properties=request.properties,
        staff=request.staff,
        tasks=target_tasks,
        distance_overrides=request.distance_overrides
    )
    
    data = create_data_model(sub_request, time_matrix_map)
    
    manager = pywrapcp.RoutingIndexManager(len(data['time_matrix']), data['num_vehicles'], data['starts'], data['ends'])
    routing = pywrapcp.RoutingModel(manager)
    
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['time_matrix'][from_node][to_node] + data['service_time'][from_node]

    transit_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
    time = 'Time'
    routing.AddDimension(
        transit_callback_index,
        1440,
        1440,
        False,
        time
    )
    time_dimension = routing.GetDimensionOrDie(time)
    
    # ── FAIR WORKLOAD DISTRIBUTION (WorkTime Dimension) ──
    # This dimension tracks ONLY the service time (actual physical labor) to ensure
    # that the AI distributes cleaning/tasks fairly among available staff.
    def work_time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        return data['service_time'][from_node]

    work_time_callback_index = routing.RegisterTransitCallback(work_time_callback)
    
    work_time = 'WorkTime'
    routing.AddDimension(
        work_time_callback_index,
        0,    # no slack
        1440, # max work time
        True, # start cumul to zero
        work_time
    )
    work_time_dimension = routing.GetDimensionOrDie(work_time)
    
    # Penalize large differences in total work time between staff to balance workload
    work_time_dimension.SetGlobalSpanCostCoefficient(1000)
    
    for node, time_window in enumerate(data['time_windows']):
        if node == data['depot']:
            continue
        index = manager.NodeToIndex(node)
        time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])
        
    for vehicle_id, (start_time, end_time) in enumerate(data['vehicle_time_windows']):
        index = routing.Start(vehicle_id)
        time_dimension.CumulVar(index).SetRange(start_time, end_time)
        end_index = routing.End(vehicle_id)
        time_dimension.CumulVar(end_index).SetRange(start_time, end_time)
        
    for node, allowed_vehicles in data['allowed_vehicles'].items():
        if not allowed_vehicles:
            continue
        index = manager.NodeToIndex(node)
        routing.VehicleVar(index).SetValues(allowed_vehicles)
        
    # Disjunction penalties based on Priority
    for node in range(1, len(data['time_matrix'])):
        task = target_tasks[node - 1]
        penalty = 1000000 # Default High
        if task.priority == 2:
            penalty = 100000 # Medium
        elif task.priority == 3:
            penalty = 10000 # Low
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)
        
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC)
    search_parameters.local_search_metaheuristic = (routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH)
    search_parameters.time_limit.FromSeconds(5)
    
    solution = routing.SolveWithParameters(search_parameters)
    
    if solution:
        return format_solution(manager, routing, solution, data, sub_request)
    else:
        # If no solution at all, return all tasks as unassigned
        return {
            "schedule": [{"staff_id": s.id, "staff_name": s.name, "tasks": []} for s in request.staff],
            "unassigned_tasks": [t.id for t in target_tasks],
            "status": "error",
            "error": "Solver failed to find any valid base routes."
        }

async def solve_schedule(request: SchedulerRequest) -> Dict[str, Any]:
    if not request.tasks or not request.staff:
        return {"error": "Need both tasks and staff to schedule"}
        
    time_matrix_map = await get_distance_matrix(request.properties, request.distance_overrides, request.headquarters)
    
    # Pass 1: Today
    today_staff = [s for s in request.staff if not s.is_off_today]
    today_request = SchedulerRequest(properties=request.properties, staff=today_staff, tasks=request.tasks, distance_overrides=request.distance_overrides, headquarters=request.headquarters)
    if today_staff:
        today_result = _run_solver(today_request, request.tasks, time_matrix_map)
    else:
        today_result = {"schedule": [], "unassigned_tasks": [t.id for t in request.tasks]}
    
    unassigned_ids = today_result.get("unassigned_tasks", [])
    tomorrow_tasks = [t for t in request.tasks if t.id in unassigned_ids]
    
    # Pass 2: Tomorrow (for overflow tasks)
    tomorrow_staff = [s for s in request.staff if not s.is_off_tomorrow]
    if tomorrow_tasks and tomorrow_staff:
        tomorrow_request = SchedulerRequest(properties=request.properties, staff=tomorrow_staff, tasks=tomorrow_tasks, distance_overrides=request.distance_overrides, headquarters=request.headquarters)
        tomorrow_result = _run_solver(tomorrow_request, tomorrow_tasks, time_matrix_map)
        final_unassigned = tomorrow_result.get("unassigned_tasks", [])
        tomorrow_schedule = tomorrow_result.get("schedule", [])
    else:
        tomorrow_schedule = []
        final_unassigned = [t.id for t in tomorrow_tasks]
        
    return {
        "today": today_result.get("schedule", []),
        "tomorrow": tomorrow_schedule,
        "unassigned_tasks": final_unassigned,
        "status": "success"
    }

def format_solution(manager, routing, solution, data, request: SchedulerRequest):
    time_dimension = routing.GetDimensionOrDie('Time')
    schedule = []
    
    for vehicle_id in range(data['num_vehicles']):
        staff = request.staff[vehicle_id]
        index = routing.Start(vehicle_id)
        route = []
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            if node_index != data['depot']:
                task = request.tasks[node_index - 1]
                time_var = time_dimension.CumulVar(index)
                start_mins = solution.Min(time_var)
                end_mins = start_mins + task.duration_mins
                route.append({
                    "task_id": task.id,
                    "property_id": task.property_id,
                    "task_type": task.task_type,
                    "start_time_mins": start_mins,
                    "end_time_mins": end_mins
                })
            index = solution.Value(routing.NextVar(index))
            
        schedule.append({
            "staff_id": staff.id,
            "staff_name": staff.name,
            "tasks": route
        })
        
    unassigned = []
    for node in range(1, len(data['time_matrix'])):
        if solution.Value(routing.NextVar(manager.NodeToIndex(node))) == manager.NodeToIndex(node):
            unassigned.append(request.tasks[node - 1].id)
            
    return {
        "schedule": schedule,
        "unassigned_tasks": unassigned,
        "status": "success"
    }
