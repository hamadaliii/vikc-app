-- ============================================================
-- VIKC DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_role AS ENUM ('member', 'staff', 'admin', 'superadmin');
CREATE TYPE event_type AS ENUM ('lecture', 'circle', 'workshop', 'sports', 'volunteer', 'ramadan', 'camp', 'competition');
CREATE TYPE event_status AS ENUM ('draft', 'upcoming', 'live', 'ended', 'cancelled');
CREATE TYPE attendance_status AS ENUM ('pending', 'verified', 'partial', 'rejected', 'flagged');
CREATE TYPE reward_category AS ENUM ('access', 'merch', 'certificate', 'tier', 'experience');

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  avatar_emoji TEXT DEFAULT '👤',
  bio TEXT,
  role user_role DEFAULT 'member',
  points INTEGER DEFAULT 0,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_current INTEGER DEFAULT 0,
  streak_max INTEGER DEFAULT 0,
  streak_last_date DATE,
  events_attended INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  type event_type NOT NULL DEFAULT 'lecture',
  status event_status DEFAULT 'upcoming',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 90,
  location_name TEXT NOT NULL,
  location_address TEXT,
  -- Geolocation
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geofence_radius_meters INTEGER DEFAULT 200,
  -- Check-in window
  checkin_opens_minutes_before INTEGER DEFAULT 60,
  checkin_closes_minutes_after INTEGER DEFAULT 30,
  -- Points
  points_reward INTEGER DEFAULT 100,
  xp_reward INTEGER DEFAULT 130,
  -- Capacity
  capacity INTEGER DEFAULT 50,
  registered_count INTEGER DEFAULT 0,
  -- Verification
  checkin_code TEXT, -- Rotating code, updated by cron
  code_updated_at TIMESTAMPTZ DEFAULT NOW(),
  require_geofence BOOLEAN DEFAULT true,
  require_code BOOLEAN DEFAULT false,
  -- Meta
  created_by UUID REFERENCES profiles(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENT REGISTRATIONS
-- ============================================================
CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status attendance_status DEFAULT 'pending',
  -- Check-in data
  checkin_at TIMESTAMPTZ,
  checkin_latitude DECIMAL(10, 8),
  checkin_longitude DECIMAL(11, 8),
  checkin_accuracy DECIMAL(8, 2), -- meters
  checkin_distance_from_venue DECIMAL(10, 2), -- meters
  -- Check-out data
  checkout_at TIMESTAMPTZ,
  checkout_latitude DECIMAL(10, 8),
  checkout_longitude DECIMAL(11, 8),
  -- Duration
  duration_minutes INTEGER,
  -- Points
  points_awarded INTEGER DEFAULT 0,
  xp_awarded INTEGER DEFAULT 0,
  -- Verification
  verified_by UUID REFERENCES profiles(id), -- admin who verified if manual
  verification_note TEXT,
  -- Flags
  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  flagged_at TIMESTAMPTZ,
  -- Override
  is_manual_override BOOLEAN DEFAULT false,
  override_by UUID REFERENCES profiles(id),
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ============================================================
-- SUSPICIOUS ATTEMPTS
-- ============================================================
CREATE TABLE suspicious_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  event_id UUID NOT NULL REFERENCES events(id),
  attempt_type TEXT NOT NULL, -- 'distance', 'time', 'duplicate', 'speed'
  description TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  distance_from_venue DECIMAL(10, 2),
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BADGES
-- ============================================================
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL,
  color TEXT DEFAULT '#6c63ff',
  condition_type TEXT NOT NULL, -- 'events_count', 'points_total', 'streak', 'event_type', 'special'
  condition_value INTEGER,
  condition_extra TEXT, -- e.g. event type for type-specific badges
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER BADGES
-- ============================================================
CREATE TABLE user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- ============================================================
-- REWARDS
-- ============================================================
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🎁',
  category reward_category DEFAULT 'experience',
  cost_points INTEGER NOT NULL,
  stock INTEGER DEFAULT 0,
  unlimited_stock BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REWARD REDEMPTIONS
-- ============================================================
CREATE TABLE reward_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  reward_id UUID NOT NULL REFERENCES rewards(id),
  points_spent INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'fulfilled', 'cancelled'
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES profiles(id)
);

-- ============================================================
-- POINTS TRANSACTIONS
-- ============================================================
CREATE TABLE points_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  amount INTEGER NOT NULL, -- positive = earn, negative = spend
  type TEXT NOT NULL, -- 'attendance', 'bonus', 'redemption', 'adjustment', 'penalty'
  description TEXT,
  reference_id UUID, -- event_id or redemption_id
  created_by UUID REFERENCES profiles(id), -- null if automatic
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'points', 'badge', 'event', 'streak', 'reminder', 'announcement'
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT DEFAULT '🔔',
  color TEXT DEFAULT '#6c63ff',
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'general', -- 'general', 'event', 'achievement', 'urgent'
  target_audience TEXT DEFAULT 'all', -- 'all', 'level_min', 'event_registered'
  target_value TEXT,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADERBOARD SNAPSHOTS (for historical tracking)
-- ============================================================
CREATE TABLE leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  period TEXT NOT NULL, -- 'monthly_2025_03', 'alltime'
  rank INTEGER,
  points INTEGER,
  events_attended INTEGER,
  snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_attendance_user ON attendance(user_id);
CREATE INDEX idx_attendance_event ON attendance(event_id);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_events_date ON events(date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_registrations_user ON event_registrations(user_id);
CREATE INDEX idx_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_points_user ON points_transactions(user_id, created_at DESC);
CREATE INDEX idx_suspicious_status ON suspicious_attempts(status);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_points ON profiles(points DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles readable by all authenticated" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Events: all authenticated can read, only admin/staff can write
CREATE POLICY "Events readable by authenticated" ON events FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin/staff can manage events" ON events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'staff'))
);

-- Registrations: users manage own, admins see all
CREATE POLICY "Users see own registrations" ON event_registrations FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'staff')));
CREATE POLICY "Users can register themselves" ON event_registrations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can unregister themselves" ON event_registrations FOR DELETE USING (user_id = auth.uid());

-- Attendance: users see own, admin/staff see all
CREATE POLICY "Users see own attendance" ON attendance FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'staff')));
CREATE POLICY "Users can create own attendance" ON attendance FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin/staff can update attendance" ON attendance FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'staff')));

-- Badges: all read
CREATE POLICY "Badges readable by all" ON badges FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin can manage badges" ON badges FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- User badges: all read, system writes
CREATE POLICY "User badges readable" ON user_badges FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users see own badge inserts" ON user_badges FOR INSERT WITH CHECK (user_id = auth.uid());

-- Rewards: all read
CREATE POLICY "Rewards readable" ON rewards FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manages rewards" ON rewards FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Redemptions: users see own
CREATE POLICY "Users see own redemptions" ON reward_redemptions FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));
CREATE POLICY "Users can redeem" ON reward_redemptions FOR INSERT WITH CHECK (user_id = auth.uid());

-- Points: users see own
CREATE POLICY "Users see own transactions" ON points_transactions FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- Notifications: users see own
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can mark read" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- Suspicious: admin only
CREATE POLICY "Admin sees suspicious" ON suspicious_attempts FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin', 'staff')));
CREATE POLICY "System inserts suspicious" ON suspicious_attempts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Announcements: all read
CREATE POLICY "Announcements readable" ON announcements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin manages announcements" ON announcements FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_rewards_updated_at BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_emoji)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_emoji', '👤')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Calculate Haversine distance (meters) between two coordinates
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DECIMAL, lon1 DECIMAL,
  lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  r DECIMAL := 6371000; -- Earth radius in meters
  dlat DECIMAL := radians(lat2 - lat1);
  dlon DECIMAL := radians(lon2 - lon1);
  a DECIMAL;
  c DECIMAL;
BEGIN
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN r * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Award points and update user stats (called after attendance verified)
CREATE OR REPLACE FUNCTION award_attendance_points(
  p_user_id UUID,
  p_event_id UUID,
  p_points INTEGER,
  p_xp INTEGER
) RETURNS VOID AS $$
DECLARE
  v_user profiles%ROWTYPE;
  v_new_level INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id FOR UPDATE;

  -- Update points, xp, events_attended
  UPDATE profiles SET
    points = points + p_points,
    xp = xp + p_xp,
    events_attended = events_attended + 1,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Update streak
  IF v_user.streak_last_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day
    UPDATE profiles SET
      streak_current = streak_current + 1,
      streak_max = GREATEST(streak_max, streak_current + 1),
      streak_last_date = v_today
    WHERE id = p_user_id;
  ELSIF v_user.streak_last_date < v_today - INTERVAL '1 day' OR v_user.streak_last_date IS NULL THEN
    -- Streak broken or first time
    UPDATE profiles SET
      streak_current = 1,
      streak_max = GREATEST(streak_max, 1),
      streak_last_date = v_today
    WHERE id = p_user_id;
  END IF;

  -- Recalculate level
  SELECT CASE
    WHEN xp + p_xp >= 5000 THEN 15
    WHEN xp + p_xp >= 4000 THEN 12
    WHEN xp + p_xp >= 3200 THEN 10
    WHEN xp + p_xp >= 2400 THEN 8
    WHEN xp + p_xp >= 2000 THEN 7
    WHEN xp + p_xp >= 1600 THEN 6
    WHEN xp + p_xp >= 1200 THEN 5
    WHEN xp + p_xp >= 800 THEN 4
    WHEN xp + p_xp >= 500 THEN 3
    WHEN xp + p_xp >= 200 THEN 2
    ELSE 1
  END INTO v_new_level;

  UPDATE profiles SET level = v_new_level WHERE id = p_user_id;

  -- Log points transaction
  INSERT INTO points_transactions (user_id, amount, type, description, reference_id)
  VALUES (p_user_id, p_points, 'attendance', 
    (SELECT 'Attendance: ' || title FROM events WHERE id = p_event_id),
    p_event_id);

  -- Check and award badges
  PERFORM check_and_award_badges(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Badge checker
CREATE OR REPLACE FUNCTION check_and_award_badges(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user profiles%ROWTYPE;
  v_badge badges%ROWTYPE;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_user FROM profiles WHERE id = p_user_id;

  FOR v_badge IN SELECT * FROM badges WHERE is_active = true LOOP
    -- Skip already earned
    IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    -- Check condition
    CASE v_badge.condition_type
      WHEN 'events_count' THEN
        IF v_user.events_attended >= v_badge.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge.id);
          INSERT INTO notifications (user_id, type, title, body, icon, color)
          VALUES (p_user_id, 'badge', 'Badge Unlocked! 🏅', 'You earned: ' || v_badge.name, v_badge.icon, v_badge.color);
        END IF;
      WHEN 'points_total' THEN
        IF v_user.points >= v_badge.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge.id);
          INSERT INTO notifications (user_id, type, title, body, icon, color)
          VALUES (p_user_id, 'badge', 'Badge Unlocked! 🏅', 'You earned: ' || v_badge.name, v_badge.icon, v_badge.color);
        END IF;
      WHEN 'streak' THEN
        IF v_user.streak_current >= v_badge.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge.id);
          INSERT INTO notifications (user_id, type, title, body, icon, color)
          VALUES (p_user_id, 'badge', 'Badge Unlocked! 🏅', 'You earned: ' || v_badge.name, v_badge.icon, v_badge.color);
        END IF;
      WHEN 'event_type' THEN
        SELECT COUNT(*) INTO v_count
        FROM attendance a
        JOIN events e ON e.id = a.event_id
        WHERE a.user_id = p_user_id AND a.status = 'verified' AND e.type::TEXT = v_badge.condition_extra;
        IF v_count >= v_badge.condition_value THEN
          INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge.id);
          INSERT INTO notifications (user_id, type, title, body, icon, color)
          VALUES (p_user_id, 'badge', 'Badge Unlocked! 🏅', 'You earned: ' || v_badge.name, v_badge.icon, v_badge.color);
        END IF;
    END CASE;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rotate event check-in code every 5 minutes (call via pg_cron or Edge Function)
CREATE OR REPLACE FUNCTION rotate_event_codes()
RETURNS VOID AS $$
BEGIN
  UPDATE events
  SET 
    checkin_code = upper(substring(md5(random()::text), 1, 6)),
    code_updated_at = NOW()
  WHERE status = 'live';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Badges
INSERT INTO badges (name, description, icon, color, condition_type, condition_value, condition_extra) VALUES
('First Steps', 'Attended your first event', '👣', '#6c63ff', 'events_count', 1, NULL),
('Streak Starter', 'Maintained a 7-day streak', '🔥', '#ff7c3a', 'streak', 7, NULL),
('Century Club', 'Earned 1000 points', '💯', '#f5a623', 'points_total', 1000, NULL),
('Community Pillar', 'Attended 10 community events', '🏛️', '#22d47a', 'events_count', 10, NULL),
('Workshop Master', 'Completed 5 workshops', '🛠️', '#38d9f5', 'event_type', 5, 'workshop'),
('Volunteer Hero', 'Completed 5 volunteer shifts', '🦸', '#ff5fa0', 'event_type', 5, 'volunteer'),
('Top 3 Legend', 'Reached top 3 on leaderboard', '🥇', '#f5a623', 'special', 0, NULL),
('Ramadan Champion', 'Attended all Ramadan events', '🌙', '#9b5de5', 'event_type', 3, 'ramadan'),
('Iron Streak', '30-day attendance streak', '⚡', '#ff4f6a', 'streak', 30, NULL),
('Team Player', 'Attended 25 events total', '🤝', '#22d47a', 'events_count', 25, NULL);

-- Rewards
INSERT INTO rewards (name, description, icon, category, cost_points, stock) VALUES
('VIP Event Access', 'Priority seating at next major event', '🎟️', 'access', 500, 10),
('VIKC Hoodie', 'Official VIKC branded hoodie', '👕', 'merch', 1000, 5),
('Recognition Certificate', 'Official certificate of excellence', '📜', 'certificate', 300, 99),
('Gold Member Status', 'Gold tier for 3 months', '⭐', 'tier', 800, 20),
('VIKC Water Bottle', 'Branded insulated bottle', '🧴', 'merch', 400, 15),
('Camp Scholarship', 'Free spot at next youth camp', '🏕️', 'access', 1500, 3),
('Mentor Session', '1-on-1 with community mentor', '🧑‍🏫', 'experience', 600, 8),
('Exclusive Sticker Pack', 'Limited edition VIKC stickers', '🎨', 'merch', 150, 50);

-- Sample Events (with geolocation - Community Hall example)
INSERT INTO events (title, description, type, status, date, start_time, duration_minutes, location_name, location_address, latitude, longitude, geofence_radius_meters, checkin_opens_minutes_before, checkin_closes_minutes_after, points_reward, xp_reward, capacity, checkin_code, require_geofence, tags) VALUES
('Leadership & Community Lecture', 'An inspiring lecture on youth leadership. Speaker: Dr. Hani Al-Faiz.', 'lecture', 'upcoming', CURRENT_DATE + 4, '18:00', 90, 'Community Hall, Block 7', '123 Community Street', 25.2048, 55.2708, 200, 60, 30, 150, 200, 60, upper(substring(md5(random()::text),1,6)), true, ARRAY['leadership','community']),
('Weekly Youth Circle', 'Our weekly discussion circle. Topic: Mental health and resilience.', 'circle', 'upcoming', CURRENT_DATE + 5, '20:00', 60, 'Masjid Al-Nour, Room 3', '456 Masjid Road', 25.1972, 55.2796, 150, 30, 20, 100, 130, 40, upper(substring(md5(random()::text),1,6)), true, ARRAY['circle','weekly']),
('Coding for Good Workshop', 'Hands-on coding for social impact.', 'workshop', 'upcoming', CURRENT_DATE + 6, '14:00', 180, 'Digital Hub, Floor 2', '789 Tech Park Ave', 25.2100, 55.2650, 250, 60, 45, 200, 280, 25, upper(substring(md5(random()::text),1,6)), true, ARRAY['tech','coding']),
('Ramadan Night Gathering', 'Special night program with quran, nasheeds, and community.', 'ramadan', 'upcoming', CURRENT_DATE + 9, '21:30', 120, 'Central Square Grounds', 'Central Square, Main Area', 25.1985, 55.2765, 500, 90, 60, 180, 250, 200, upper(substring(md5(random()::text),1,6)), true, ARRAY['ramadan','special']),
('Youth Leadership Camp', '3-day overnight leadership camp.', 'camp', 'upcoming', CURRENT_DATE + 25, '08:00', 2880, 'Green Valley Campsite', 'Green Valley, Outskirts', 25.1500, 55.3200, 1000, 120, 60, 500, 700, 45, upper(substring(md5(random()::text),1,6)), true, ARRAY['camp','overnight']),
('Environmental Cleanup Drive', 'Join us to clean our coastal park.', 'volunteer', 'upcoming', CURRENT_DATE + 13, '07:00', 180, 'Coastal Park', 'Coastal Park, Beach Road', 25.2200, 55.2400, 300, 60, 30, 140, 190, 80, upper(substring(md5(random()::text),1,6)), true, ARRAY['environment','volunteer']);
