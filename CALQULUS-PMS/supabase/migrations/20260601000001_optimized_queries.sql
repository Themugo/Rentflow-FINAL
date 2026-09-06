-- Performance Optimization: RPC functions for dashboard stats
-- These functions reduce multiple round trips to a single database call

-- Function to get comprehensive dashboard stats in one call
CREATE OR REPLACE FUNCTION get_manager_dashboard_stats(p_manager_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
  v_prev_start_date DATE := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
BEGIN
  SELECT jsonb_build_object(
    'total_tenants', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id
    ),
    'active_tenants', (
      SELECT COUNT(*) FROM tenants WHERE manager_id = p_manager_id AND status = 'active'
    ),
    'total_properties', (
      SELECT COUNT(*) FROM properties WHERE manager_id = p_manager_id AND status != 'inactive'
    ),
    'total_units', COALESCE((
      SELECT SUM(units) FROM properties WHERE manager_id = p_manager_id AND status != 'inactive'
    ), 0),
    'occupied_units', COALESCE((
      SELECT SUM(occupied_units) FROM properties WHERE manager_id = p_manager_id AND status != 'inactive'
    ), 0),
    'revenue_mtd', COALESCE((
      SELECT COALESCE(SUM(amount), 0) 
      FROM invoices 
      WHERE manager_id = p_manager_id 
        AND status = 'paid'
        AND paid_date >= v_start_date
    ), 0),
    'revenue_prev_month', COALESCE((
      SELECT COALESCE(SUM(amount), 0) 
      FROM invoices 
      WHERE manager_id = p_manager_id 
        AND status = 'paid'
        AND paid_date >= v_prev_start_date
        AND paid_date < v_start_date
    ), 0),
    'pending_invoices', (
      SELECT COUNT(*) FROM invoices WHERE manager_id = p_manager_id AND status = 'pending'
    ),
    'overdue_invoices', (
      SELECT COUNT(*) FROM invoices WHERE manager_id = p_manager_id AND status = 'overdue'
    ),
    'arrears_total', COALESCE((
      SELECT COALESCE(SUM(balance_due), 0) 
      FROM invoices 
      WHERE manager_id = p_manager_id AND status = 'overdue'
    ), 0),
    'active_leases', (
      SELECT COUNT(*) FROM leases WHERE manager_id = p_manager_id AND status = 'active'
    ),
    'expiring_leases_30d', (
      SELECT COUNT(*) FROM leases 
      WHERE manager_id = p_manager_id 
        AND status = 'active'
        AND end_date <= CURRENT_DATE + INTERVAL '30 days'
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Function to get tenant list with property names (single join query)
CREATE OR REPLACE FUNCTION get_tenants_with_properties(p_manager_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  status TEXT,
  property_name TEXT,
  property_id UUID,
  unit_id UUID,
  unit_label TEXT,
  monthly_rent NUMERIC,
  move_in_date DATE,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.email,
    t.phone,
    t.status,
    p.name as property_name,
    t.property_id,
    t.unit_id,
    pu.label as unit_label,
    t.monthly_rent,
    t.move_in_date,
    t.created_at
  FROM tenants t
  LEFT JOIN properties p ON p.id = t.property_id
  LEFT JOIN property_units pu ON pu.id = t.unit_id
  WHERE t.manager_id = p_manager_id
  ORDER BY t.name;
END;
$$;

-- Function to get property summary with tenant counts
CREATE OR REPLACE FUNCTION get_properties_with_tenant_counts(p_manager_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  address TEXT,
  units INTEGER,
  occupied_units INTEGER,
  revenue NUMERIC,
  image_url TEXT,
  tenant_count BIGINT,
  active_tenant_count BIGINT,
  occupancy_rate NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.name,
    pr.address,
    pr.units,
    pr.occupied_units,
    pr.revenue,
    pr.image_url,
    COUNT(t.id) as tenant_count,
    COUNT(t.id) FILTER (WHERE t.status = 'active') as active_tenant_count,
    CASE WHEN pr.units > 0 THEN ROUND((pr.occupied_units::NUMERIC / pr.units) * 100, 1) ELSE 0 END as occupancy_rate,
    pr.status
  FROM properties pr
  LEFT JOIN tenants t ON t.property_id = pr.id
  WHERE pr.manager_id = p_manager_id AND pr.status != 'inactive'
  GROUP BY pr.id, pr.name, pr.address, pr.units, pr.occupied_units, pr.revenue, pr.image_url, pr.status
  ORDER BY pr.created_at DESC;
END;
$$;

-- Function to get recent activity (combined)
CREATE OR REPLACE FUNCTION get_manager_recent_activity(p_manager_id UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE(
  id UUID,
  action TEXT,
  description TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    action,
    description,
    entity_type,
    entity_id,
    created_at
  FROM activity_logs
  WHERE actor_id = p_manager_id
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;

-- Index optimization for common queries
CREATE INDEX IF NOT EXISTS idx_tenants_manager_status ON tenants(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_tenants_property ON tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_properties_manager ON properties(manager_id) WHERE status != 'inactive';
CREATE INDEX IF NOT EXISTS idx_invoices_manager_status ON invoices(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_paid_date ON invoices(manager_id, paid_date) WHERE status = 'paid';
CREATE INDEX IF NOT EXISTS idx_leases_manager_status ON leases(manager_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_end_date ON leases(manager_id, end_date) WHERE status = 'active';

-- Comment on new functions
COMMENT ON FUNCTION get_manager_dashboard_stats IS 'Returns comprehensive dashboard stats for a manager in a single call';
COMMENT ON FUNCTION get_tenants_with_properties IS 'Returns tenants with their property and unit names pre-joined';
COMMENT ON FUNCTION get_properties_with_tenant_counts IS 'Returns properties with computed tenant counts and occupancy rates';
COMMENT ON FUNCTION get_manager_recent_activity IS 'Returns recent activity logs for a manager';
