// ============================================================
// VIKC — Database Types
// Auto-maps to Supabase schema
// ============================================================

export type UserRole = 'member' | 'staff' | 'admin' | 'superadmin'
export type EventType = 'lecture' | 'circle' | 'workshop' | 'sports' | 'volunteer' | 'ramadan' | 'camp' | 'competition'
export type EventStatus = 'draft' | 'upcoming' | 'live' | 'ended' | 'cancelled'
export type AttendanceStatus = 'pending' | 'verified' | 'partial' | 'rejected' | 'flagged'
export type RewardCategory = 'access' | 'merch' | 'certificate' | 'tier' | 'experience'

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url?: string
  avatar_emoji: string
  bio?: string
  role: UserRole
  points: number
  xp: number
  level: number
  streak_current: number
  streak_max: number
  streak_last_date?: string
  events_attended: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  title: string
  description?: string
  type: EventType
  status: EventStatus
  date: string
  start_time: string
  duration_minutes: number
  location_name: string
  location_address?: string
  latitude?: number
  longitude?: number
  geofence_radius_meters: number
  checkin_opens_minutes_before: number
  checkin_closes_minutes_after: number
  points_reward: number
  xp_reward: number
  capacity: number
  registered_count: number
  checkin_code?: string
  code_updated_at: string
  require_geofence: boolean
  require_code: boolean
  created_by?: string
  tags: string[]
  created_at: string
  updated_at: string
  // Joined fields
  is_registered?: boolean
  my_attendance?: Attendance
}

export interface EventRegistration {
  id: string
  event_id: string
  user_id: string
  registered_at: string
}

export interface Attendance {
  id: string
  event_id: string
  user_id: string
  status: AttendanceStatus
  checkin_at?: string
  checkin_latitude?: number
  checkin_longitude?: number
  checkin_accuracy?: number
  checkin_distance_from_venue?: number
  checkout_at?: string
  checkout_latitude?: number
  checkout_longitude?: number
  duration_minutes?: number
  points_awarded: number
  xp_awarded: number
  verified_by?: string
  verification_note?: string
  is_flagged: boolean
  flag_reason?: string
  is_manual_override: boolean
  override_by?: string
  override_reason?: string
  created_at: string
  // Joined
  event?: Event
  user?: Profile
}

export interface Badge {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  condition_type: string
  condition_value?: number
  condition_extra?: string
  is_active: boolean
  created_at: string
  // Joined
  is_earned?: boolean
  earned_at?: string
}

export interface Reward {
  id: string
  name: string
  description?: string
  icon: string
  category: RewardCategory
  cost_points: number
  stock: number
  unlimited_stock: boolean
  is_active: boolean
  image_url?: string
  created_at: string
  updated_at: string
}

export interface RewardRedemption {
  id: string
  user_id: string
  reward_id: string
  points_spent: number
  status: string
  redeemed_at: string
  fulfilled_at?: string
  fulfilled_by?: string
  // Joined
  reward?: Reward
}

export interface PointsTransaction {
  id: string
  user_id: string
  amount: number
  type: string
  description?: string
  reference_id?: string
  created_by?: string
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body?: string
  icon: string
  color: string
  is_read: boolean
  action_url?: string
  created_at: string
}

export interface SuspiciousAttempt {
  id: string
  user_id: string
  event_id: string
  attempt_type: string
  description?: string
  latitude?: number
  longitude?: number
  distance_from_venue?: number
  status: string
  reviewed_by?: string
  reviewed_at?: string
  review_note?: string
  created_at: string
  // Joined
  user?: Profile
  event?: Event
}

export interface Announcement {
  id: string
  title: string
  body: string
  type: string
  target_audience: string
  target_value?: string
  sent_by?: string
  sent_at: string
  created_at: string
}

// ============================================================
// API Response types
// ============================================================

export interface CheckinRequest {
  event_id: string
  latitude: number
  longitude: number
  accuracy: number
  code?: string
}

export interface CheckinResponse {
  success: boolean
  status: AttendanceStatus
  distance_from_venue?: number
  is_within_geofence?: boolean
  points_awarded?: number
  xp_awarded?: number
  message: string
  attendance_id?: string
}

export interface GeolocationState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'error' | 'locating'
  latitude?: number
  longitude?: number
  accuracy?: number
  error?: string
  timestamp?: number
}

export interface CheckinState {
  step: 'idle' | 'locating' | 'located' | 'verifying' | 'success' | 'failed'
  geo: GeolocationState
  distanceFromVenue?: number
  isWithinGeofence?: boolean
  errorMessage?: string
  result?: CheckinResponse
}

// ============================================================
// Leaderboard
// ============================================================
export interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  username: string
  avatar_emoji: string
  level: number
  points: number
  events_attended: number
  streak_current: number
}
