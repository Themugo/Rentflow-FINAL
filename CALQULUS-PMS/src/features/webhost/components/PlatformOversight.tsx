import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Users, Building, Home, BarChart3, Eye } from 'lucide-react';

interface ManagerOversight {
  user_id: string;
  email: string;
  full_name: string | null;
  property_count: number;
  unit_count: number;
  occupied_unit_count: number;
}

const PlatformOversight = () => {
  const { data: managers, isLoading } = useQuery({
    queryKey: ['platform-oversight-v2'],
    queryFn: async () => {
      const { data: managerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');

      if (!managerRoles) return [];

      const results: ManagerOversight[] = [];
      for (const role of managerRoles) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', role.user_id)
          .maybeSingle();

        const { count: propCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('manager_id', role.user_id);

        const { data: managerProperties } = await supabase
          .from('properties')
          .select('id')
          .eq('manager_id', role.user_id);

        const propertyIds = (managerProperties || []).map(p => p.id);

        const { data: units } = propertyIds.length > 0
          ? await supabase
          .from('units')
          .select('id, status')
          .in('property_id', propertyIds)
          : { data: [] };

        const occupiedUnitCount = (units || []).filter(u => u.status === 'occupied').length;

        results.push({
          user_id: role.user_id,
          email: profile?.email || 'Unknown',
          full_name: profile?.full_name || null,
          property_count: propCount || 0,
          unit_count: units?.length || 0,
          occupied_unit_count: occupiedUnitCount,
        });
      }
      return results;
    },
  });

  const totalProperties = managers?.reduce((s, m) => s + m.property_count, 0) || 0;
  const totalUnits = managers?.reduce((s, m) => s + m.unit_count, 0) || 0;
  const totalOccupiedUnits = managers?.reduce((s, m) => s + m.occupied_unit_count, 0) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Managers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{managers?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building className="h-4 w-4" /> Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalProperties}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Home className="h-4 w-4" /> Units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalUnits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Home className="h-4 w-4" /> Occupied Units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalOccupiedUnits}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Eye className="h-5 w-5 text-[hsl(218_58%_50%)]" />
            Manager Oversight
          </CardTitle>
          <CardDescription>
            Aggregate portfolio overview per manager. Tenant records and personal data are not queried here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
            </div>
          ) : !managers || managers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No managers registered yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Properties</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Occupied Units</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map(m => (
                  <TableRow key={m.user_id}>
                    <TableCell className="font-medium">{m.full_name || 'N/A'}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell className="text-right">{m.property_count}</TableCell>
                    <TableCell className="text-right">{m.unit_count}</TableCell>
                    <TableCell className="text-right">{m.occupied_unit_count}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformOversight;
