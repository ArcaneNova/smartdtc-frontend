export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'dispatcher' | 'driver' | 'passenger';
  phone?: string;
  profileImage?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Route {
  _id: string;
  url_route_id: string;
  route_name: string;
  start_stage: string;
  end_stage: string;
  distance_km: number;
  total_stages: number;
  isActive: boolean;
}

export interface Stage {
  _id: string;
  url_route_id: string;
  seq: number;
  stage_id: string;
  stage_name: string;
  location?: { type: 'Point'; coordinates: [number, number] };
}

export interface Bus {
  _id: string;
  busNumber: string;
  registrationNo: string;
  model: string;
  capacity: number;
  type: 'AC' | 'non-AC' | 'electric';
  status: 'active' | 'idle' | 'maintenance' | 'retired';
  busQrId?: string;
  currentRoute?: Route;
  currentDriver?: string;
  lastPosition?: { lat: number; lng: number; speed: number; timestamp: string };
}

export interface Driver {
  _id: string;
  userId: User;
  licenseNo: string;
  experience: number;
  assignedBus?: Bus;
  assignedRoute?: Route;
  status: 'on-duty' | 'off-duty' | 'on-leave';
  rating: number;
}

export interface Schedule {
  _id: string;
  route: Route;
  bus: Bus;
  driver: Driver;
  date: string;
  departureTime: string;
  estimatedArrivalTime: string;
  type: 'regular' | 'peak' | 'express' | 'emergency';
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  generatedBy: 'manual' | 'ai-auto' | 'admin';
}

export interface BusPosition {
  _id: string;
  bus: string;
  busNumber?: string;
  route?: string;
  routeId?: string;
  routeName?: string;
  lat?: number;
  lng?: number;
  location: { type: 'Point'; coordinates: [number, number] };
  speed: number;
  heading: number;
  delay_minutes: number;
  timestamp: string;
  nextStage?: { stage_name: string };
  distanceToNextStop?: number;
  stopsRemaining?: number;
  isSimulated?: boolean;
}

export interface Alert {
  _id: string;
  type: 'delay' | 'overcrowding' | 'breakdown' | 'route-change' | 'traffic' | 'sos';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  route?: Route;
  bus?: Bus;
  isResolved: boolean;
  createdAt: string;
}

export interface DashboardSummary {
  totalTripsToday: number;
  completedToday: number;
  activeAlerts: number;
  criticalAlerts: number;
  date: string;
}
