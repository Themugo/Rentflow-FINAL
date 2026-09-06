import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  Wrench, AlertTriangle, CheckCircle, Clock, Search, Filter,
  Download, RefreshCw, Calendar, Building, DollarSign, TrendingUp,
  Activity, Zap, Settings, User, MapPin, BarChart3, Thermometer,
  Droplets, Fan, Lightbulb
} from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  type: 'hvac' | 'plumbing' | 'electrical' | 'elevator' | 'security' | 'other';
  propertyId: string;
  propertyName: string;
  location: string;
  installDate: Date;
  lastMaintenance: Date;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  healthScore: number;
  predictedFailureDate?: Date;
  failureProbability: number;
}

interface MaintenancePrediction {
  id: string;
  equipmentId: string;
  equipmentName: string;
  predictedFailureDate: Date;
  failureProbability: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendedAction: string;
  estimatedCost: number;
  urgency: 'immediate' | 'urgent' | 'scheduled' | 'monitor';
}

interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  equipmentName: string;
  scheduledDate: Date;
  type: 'preventive' | 'predictive' | 'corrective';
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedDuration: string;
  assignedTo: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

interface CostForecast {
  period: string;
  predictedCost: number;
  actualCost?: number;
  savings: number;
  category: 'preventive' | 'corrective' | 'emergency';
}

const PredictiveMaintenanceDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');

  // Mock data - in production, this would come from the predictive maintenance analytics API
  const equipment: Equipment[] = [
    {
      id: 'EQ-001',
      name: 'Central AC Unit',
      type: 'hvac',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      location: 'Building A - Roof',
      installDate: new Date('2020-01-15'),
      lastMaintenance: new Date('2026-05-01'),
      condition: 'good',
      healthScore: 78,
      predictedFailureDate: new Date('2026-09-15'),
      failureProbability: 35
    },
    {
      id: 'EQ-002',
      name: 'Water Pump System',
      type: 'plumbing',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      location: 'Building B - Basement',
      installDate: new Date('2019-06-20'),
      lastMaintenance: new Date('2026-04-15'),
      condition: 'fair',
      healthScore: 62,
      predictedFailureDate: new Date('2026-07-20'),
      failureProbability: 58
    },
    {
      id: 'EQ-003',
      name: 'Main Electrical Panel',
      type: 'electrical',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      location: 'Building C - Utility Room',
      installDate: new Date('2018-03-10'),
      lastMaintenance: new Date('2026-05-20'),
      condition: 'critical',
      healthScore: 42,
      predictedFailureDate: new Date('2026-06-25'),
      failureProbability: 85
    },
    {
      id: 'EQ-004',
      name: 'Elevator System',
      type: 'elevator',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      location: 'Building C - Main Shaft',
      installDate: new Date('2017-11-05'),
      lastMaintenance: new Date('2026-05-25'),
      condition: 'good',
      healthScore: 82,
      predictedFailureDate: new Date('2027-01-10'),
      failureProbability: 22
    },
    {
      id: 'EQ-005',
      name: 'Security Camera System',
      type: 'security',
      propertyId: 'PROP-003',
      propertyName: 'Garden View',
      location: 'Perimeter',
      installDate: new Date('2021-02-28'),
      lastMaintenance: new Date('2026-06-01'),
      condition: 'excellent',
      healthScore: 95,
      failureProbability: 8
    }
  ];

  const maintenancePredictions: MaintenancePrediction[] = [
    {
      id: 'PRED-001',
      equipmentId: 'EQ-003',
      equipmentName: 'Main Electrical Panel',
      predictedFailureDate: new Date('2026-06-25'),
      failureProbability: 85,
      severity: 'critical',
      recommendedAction: 'Immediate inspection and component replacement',
      estimatedCost: 45000,
      urgency: 'immediate'
    },
    {
      id: 'PRED-002',
      equipmentId: 'EQ-002',
      equipmentName: 'Water Pump System',
      predictedFailureDate: new Date('2026-07-20'),
      failureProbability: 58,
      severity: 'high',
      recommendedAction: 'Preventive maintenance and seal replacement',
      estimatedCost: 15000,
      urgency: 'urgent'
    },
    {
      id: 'PRED-003',
      equipmentId: 'EQ-001',
      equipmentName: 'Central AC Unit',
      predictedFailureDate: new Date('2026-09-15'),
      failureProbability: 35,
      severity: 'medium',
      recommendedAction: 'Scheduled maintenance and filter replacement',
      estimatedCost: 8000,
      urgency: 'scheduled'
    }
  ];

  const maintenanceSchedule: MaintenanceSchedule[] = [
    {
      id: 'SCHED-001',
      equipmentId: 'EQ-003',
      equipmentName: 'Main Electrical Panel',
      scheduledDate: new Date('2026-06-10'),
      type: 'predictive',
      priority: 'critical',
      estimatedDuration: '4 hours',
      assignedTo: 'Electrical Contractor A',
      status: 'scheduled'
    },
    {
      id: 'SCHED-002',
      equipmentId: 'EQ-002',
      equipmentName: 'Water Pump System',
      scheduledDate: new Date('2026-06-25'),
      type: 'preventive',
      priority: 'high',
      estimatedDuration: '2 hours',
      assignedTo: 'Plumbing Contractor B',
      status: 'scheduled'
    },
    {
      id: 'SCHED-003',
      equipmentId: 'EQ-001',
      equipmentName: 'Central AC Unit',
      scheduledDate: new Date('2026-07-01'),
      type: 'preventive',
      priority: 'medium',
      estimatedDuration: '3 hours',
      assignedTo: 'HVAC Contractor C',
      status: 'scheduled'
    }
  ];

  const costForecasts: CostForecast[] = [
    {
      period: 'June 2026',
      predictedCost: 85000,
      actualCost: 78000,
      savings: 7000,
      category: 'preventive'
    },
    {
      period: 'July 2026',
      predictedCost: 92000,
      savings: 12000,
      category: 'preventive'
    },
    {
      period: 'August 2026',
      predictedCost: 78000,
      savings: 15000,
      category: 'preventive'
    },
    {
      period: 'September 2026',
      predictedCost: 105000,
      savings: 8000,
      category: 'corrective'
    }
  ];

  const filteredEquipment = equipment.filter(eq => {
    const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         eq.propertyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || eq.type === selectedType;
    const matchesCondition = selectedCondition === 'all' || eq.condition === selectedCondition;
    return matchesSearch && matchesType && matchesCondition;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'good':
      case 'scheduled':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'fair':
      case 'in_progress':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Activity className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'poor':
      case 'cancelled':
        return <Badge className="bg-warning/10 text-warning border-orange-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'critical':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-destructive text-white border-red-700">{severity}</Badge>;
      case 'high':
        return <Badge className="bg-warning text-white border-warning">{severity}</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-warning-foreground border-warning">{severity}</Badge>;
      case 'low':
        return <Badge className="bg-blue-500 text-white border-blue-600">{severity}</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'hvac':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><Fan className="h-3 w-3 mr-1" />{type.toUpperCase()}</Badge>;
      case 'plumbing':
        return <Badge variant="outline" className="text-[hsl(195_60%_60%)] border-[hsl(195_60%_38%)]"><Droplets className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'electrical':
        return <Badge variant="outline" className="text-yellow-300 border-yellow-700"><Lightbulb className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'elevator':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><Settings className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'security':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Zap className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'immediate':
        return <Badge className="bg-destructive text-white border-red-700">{urgency}</Badge>;
      case 'urgent':
        return <Badge className="bg-warning text-white border-warning">{urgency}</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500 text-white border-blue-600">{urgency}</Badge>;
      case 'monitor':
        return <Badge className="bg-secondary-foreground text-white border-gray-600">{urgency}</Badge>;
      default:
        return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hvac':
        return <Fan className="h-4 w-4 text-[hsl(214_73%_58%)]" />;
      case 'plumbing':
        return <Droplets className="h-4 w-4 text-[hsl(195_60%_50%)]" />;
      case 'electrical':
        return <Lightbulb className="h-4 w-4 text-yellow-400" />;
      case 'elevator':
        return <Settings className="h-4 w-4 text-warning" />;
      case 'security':
        return <Zap className="h-4 w-4 text-green-400" />;
      default:
        return <Wrench className="h-4 w-4 text-gray-400" />;
    }
  };

  const totalEquipment = equipment.length;
  const criticalEquipment = equipment.filter(e => e.condition === 'critical').length;
  const upcomingMaintenance = maintenanceSchedule.filter(s => s.status === 'scheduled').length;
  const predictedSavings = costForecasts.reduce((sum, f) => sum + f.savings, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Predictive Maintenance Dashboard</h2>
          <p className="text-warning/70 text-sm mt-1">AI-powered equipment health and maintenance forecasting</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-warning/30 text-warning/80 hover:bg-warning/8"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-warning/30 text-warning/80 hover:bg-warning/8"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-warning" />
              Total Equipment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalEquipment}</div>
            <div className="text-sm text-warning/70">Tracked assets</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{criticalEquipment}</div>
            <div className="text-sm text-warning/70">Need attention</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-warning" />
              Upcoming Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{upcomingMaintenance}</div>
            <div className="text-sm text-warning/70">Scheduled</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-warning" />
              Predicted Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">KES {predictedSavings.toLocaleString()}</div>
            <div className="text-sm text-warning/70">This quarter</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            Overview
          </TabsTrigger>
          <TabsTrigger value="equipment" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Wrench className="h-4 w-4 mr-2" />
            Equipment
          </TabsTrigger>
          <TabsTrigger value="predictions" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Activity className="h-4 w-4 mr-2" />
            Predictions
          </TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="costs" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <BarChart3 className="h-4 w-4 mr-2" />
            Costs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Critical Equipment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {equipment.filter(e => e.condition === 'critical' || e.healthScore < 50).slice(0, 3).map((eq) => (
                    <div key={eq.id} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(eq.type)}
                          <span className="text-foreground text-sm font-medium">{eq.name}</span>
                        </div>
                        {getStatusBadge(eq.condition)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70 mb-2">
                        <span>Health: {eq.healthScore}%</span>
                        <span>Failure Risk: {eq.failureProbability}%</span>
                      </div>
                      {eq.predictedFailureDate && (
                        <div className="text-xs text-warning/70">
                          Predicted Failure: {eq.predictedFailureDate.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-warning" />
                  Cost Savings Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {costForecasts.slice(0, 4).map((forecast) => (
                    <div key={forecast.period} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-sm font-medium">{forecast.period}</span>
                        <Badge variant="outline" className="text-warning/70 border-warning/30 capitalize">
                          {forecast.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70">
                        <span>Predicted: KES {forecast.predictedCost.toLocaleString()}</span>
                        {forecast.actualCost && (
                          <span>Actual: KES {forecast.actualCost.toLocaleString()}</span>
                        )}
                      </div>
                      <div className="text-xs text-green-400 mt-1">
                        Savings: KES {forecast.savings.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipment">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Equipment Inventory</CardTitle>
              <CardDescription className="text-warning/70">
                Monitor equipment health and condition
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search equipment..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Types</option>
                  <option value="hvac">HVAC</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="elevator">Elevator</option>
                  <option value="security">Security</option>
                </select>
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Conditions</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Equipment List */}
              <div className="space-y-4">
                {filteredEquipment.map((eq) => (
                  <div key={eq.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(eq.type)}
                          <span className="text-foreground font-medium">{eq.name}</span>
                          <span className="text-warning/70 text-sm">{eq.id}</span>
                          {getTypeBadge(eq.type)}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(eq.condition)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {eq.propertyName}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {eq.location}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Health Score: {eq.healthScore}%
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Failure Risk: {eq.failureProbability}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Last Maintenance: {eq.lastMaintenance.toLocaleDateString()}
                        </span>
                        {eq.predictedFailureDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Predicted Failure: {eq.predictedFailureDate.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <Progress value={eq.healthScore} className="h-2 mt-2" />
                    </div>
                    <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Maintenance Predictions</CardTitle>
              <CardDescription className="text-warning/70">
                AI-powered failure predictions and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {maintenancePredictions.map((prediction) => (
                  <div key={prediction.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{prediction.equipmentName}</span>
                          <span className="text-warning/70 text-sm ml-2">{prediction.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(prediction.severity)}
                          {getUrgencyBadge(prediction.urgency)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{prediction.recommendedAction}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Failure Probability: {prediction.failureProbability}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Predicted: {prediction.predictedFailureDate.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Estimated Cost: KES {prediction.estimatedCost.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={prediction.failureProbability} className="h-2 mt-2" />
                    </div>
                    <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                      Schedule Maintenance
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Maintenance Schedule</CardTitle>
              <CardDescription className="text-warning/70">
                Upcoming preventive and predictive maintenance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {maintenanceSchedule.map((schedule) => (
                  <div key={schedule.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{schedule.equipmentName}</span>
                          <span className="text-warning/70 text-sm ml-2">{schedule.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {schedule.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(schedule.priority)}
                          {getStatusBadge(schedule.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled: {schedule.scheduledDate.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Duration: {schedule.estimatedDuration}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Assigned: {schedule.assignedTo}
                        </span>
                      </div>
                    </div>
                    {schedule.status === 'scheduled' && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        View Details
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Cost Forecast</CardTitle>
              <CardDescription className="text-warning/70">
                Predictive maintenance cost analysis and savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {costForecasts.map((forecast) => (
                  <div key={forecast.period} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-foreground font-medium">{forecast.period}</span>
                      <Badge variant="outline" className="text-warning/70 border-warning/30 capitalize">
                        {forecast.category}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <div className="text-2xl font-bold text-foreground">KES {forecast.predictedCost.toLocaleString()}</div>
                        <div className="text-xs text-warning/70">Predicted Cost</div>
                      </div>
                      {forecast.actualCost && (
                        <div>
                          <div className="text-2xl font-bold text-foreground">KES {forecast.actualCost.toLocaleString()}</div>
                          <div className="text-xs text-warning/70">Actual Cost</div>
                        </div>
                      )}
                      <div>
                        <div className="text-2xl font-bold text-foreground">KES {forecast.savings.toLocaleString()}</div>
                        <div className="text-xs text-warning/70">Savings</div>
                      </div>
                    </div>
                    {forecast.actualCost && (
                      <Progress value={(forecast.savings / forecast.predictedCost) * 100} className="h-2" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PredictiveMaintenanceDashboard;
