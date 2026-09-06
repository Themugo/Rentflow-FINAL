import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  Building, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Search, Filter, Download, RefreshCw, Calendar, Users, Activity,
  Target, BarChart3, PieChart, LineChart, MapPin, DollarSign,
  Clock, ArrowUp, ArrowDown, Home, Zap, CalendarDays
} from 'lucide-react';

interface OccupancyForecast {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyType: 'apartment' | 'house' | 'commercial' | 'office';
  location: string;
  currentOccupancy: number;
  forecastedOccupancy: number;
  change: number;
  changeType: 'increase' | 'decrease';
  timeframe: string;
  confidence: number;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
}

interface SeasonalPattern {
  id: string;
  season: string;
  months: string[];
  averageOccupancy: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  factors: string[];
}

interface LeaseExpiration {
  id: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  tenantName: string;
  leaseEndDate: Date;
  daysUntilExpiration: number;
  renewalProbability: number;
  estimatedRevenueLoss: number;
  status: 'expiring_soon' | 'at_risk' | 'likely_renewal' | 'unknown';
}

interface MarketInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'trend';
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  actionable: boolean;
}

const OccupancyForecastingDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all');

  // Mock data - in production, this would come from the occupancy forecasting analytics API
  const occupancyForecasts: OccupancyForecast[] = [
    {
      id: 'OCC-001',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      propertyType: 'apartment',
      location: 'Nairobi CBD',
      currentOccupancy: 87.5,
      forecastedOccupancy: 92.0,
      change: 4.5,
      changeType: 'increase',
      timeframe: '3 months',
      confidence: 85,
      totalUnits: 40,
      occupiedUnits: 35,
      availableUnits: 5
    },
    {
      id: 'OCC-002',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      propertyType: 'apartment',
      location: 'Westlands',
      currentOccupancy: 82.3,
      forecastedOccupancy: 78.5,
      change: -3.8,
      changeType: 'decrease',
      timeframe: '3 months',
      confidence: 72,
      totalUnits: 60,
      occupiedUnits: 49,
      availableUnits: 11
    },
    {
      id: 'OCC-003',
      propertyId: 'PROP-003',
      propertyName: 'Garden View',
      propertyType: 'house',
      location: 'Karen',
      currentOccupancy: 95.0,
      forecastedOccupancy: 96.5,
      change: 1.5,
      changeType: 'increase',
      timeframe: '3 months',
      confidence: 90,
      totalUnits: 20,
      occupiedUnits: 19,
      availableUnits: 1
    },
    {
      id: 'OCC-004',
      propertyId: 'PROP-004',
      propertyName: 'Business Center',
      propertyType: 'commercial',
      location: 'Industrial Area',
      currentOccupancy: 65.0,
      forecastedOccupancy: 70.0,
      change: 5.0,
      changeType: 'increase',
      timeframe: '6 months',
      confidence: 65,
      totalUnits: 50,
      occupiedUnits: 33,
      availableUnits: 17
    },
    {
      id: 'OCC-005',
      propertyId: 'PROP-005',
      propertyName: 'Office Plaza',
      propertyType: 'office',
      location: 'Upper Hill',
      currentOccupancy: 78.5,
      forecastedOccupancy: 75.0,
      change: -3.5,
      changeType: 'decrease',
      timeframe: '3 months',
      confidence: 68,
      totalUnits: 30,
      occupiedUnits: 24,
      availableUnits: 6
    }
  ];

  const seasonalPatterns: SeasonalPattern[] = [
    {
      id: 'SEAS-001',
      season: 'Peak Season (Dec-Feb)',
      months: ['December', 'January', 'February'],
      averageOccupancy: 92.5,
      trend: 'increasing',
      factors: ['Holiday demand', 'New year relocations', 'Corporate hiring']
    },
    {
      id: 'SEAS-002',
      season: 'High Season (Mar-May)',
      months: ['March', 'April', 'May'],
      averageOccupancy: 88.0,
      trend: 'stable',
      factors: ['Academic year start', 'Corporate relocations', 'Spring leasing']
    },
    {
      id: 'SEAS-003',
      season: 'Low Season (Jun-Aug)',
      months: ['June', 'July', 'August'],
      averageOccupancy: 82.5,
      trend: 'decreasing',
      factors: ['Summer vacations', 'School holidays', 'Reduced corporate activity']
    },
    {
      id: 'SEAS-004',
      season: 'Recovery Season (Sep-Nov)',
      months: ['September', 'October', 'November'],
      averageOccupancy: 86.0,
      trend: 'increasing',
      factors: ['Academic year return', 'Corporate Q4 planning', 'Holiday preparation']
    }
  ];

  const leaseExpirations: LeaseExpiration[] = [
    {
      id: 'LEASE-001',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      unit: 'A-101',
      tenantName: 'John Kamau',
      leaseEndDate: new Date('2026-06-30'),
      daysUntilExpiration: 27,
      renewalProbability: 85,
      estimatedRevenueLoss: 15000,
      status: 'likely_renewal'
    },
    {
      id: 'LEASE-002',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      unit: 'B-201',
      tenantName: 'Peter Ochieng',
      leaseEndDate: new Date('2026-07-15'),
      daysUntilExpiration: 42,
      renewalProbability: 45,
      estimatedRevenueLoss: 8000,
      status: 'at_risk'
    },
    {
      id: 'LEASE-003',
      propertyId: 'PROP-003',
      propertyName: 'Garden View',
      unit: 'C-301',
      tenantName: 'James Mwangi',
      leaseEndDate: new Date('2026-06-20'),
      daysUntilExpiration: 17,
      renewalProbability: 25,
      estimatedRevenueLoss: 5000,
      status: 'expiring_soon'
    },
    {
      id: 'LEASE-004',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      unit: 'A-102',
      tenantName: 'Mary Wanjiku',
      leaseEndDate: new Date('2026-12-31'),
      daysUntilExpiration: 181,
      renewalProbability: 78,
      estimatedRevenueLoss: 12000,
      status: 'likely_renewal'
    }
  ];

  const marketInsights: MarketInsight[] = [
    {
      id: 'INS-001',
      type: 'opportunity',
      category: 'Market Expansion',
      title: 'High Demand in Nairobi CBD',
      description: 'Nairobi CBD showing 15% increase in rental demand due to commercial growth',
      impact: 'high',
      confidence: 82,
      actionable: true
    },
    {
      id: 'INS-002',
      type: 'risk',
      category: 'Market Saturation',
      title: 'Westlands Oversupply',
      description: 'Westlands area showing signs of oversupply with 20% increase in available units',
      impact: 'high',
      confidence: 75,
      actionable: true
    },
    {
      id: 'INS-003',
      type: 'trend',
      category: 'Pricing',
      title: 'Rent Price Stabilization',
      description: 'Rent prices stabilizing across most areas after 6 months of growth',
      impact: 'medium',
      confidence: 88,
      actionable: false
    },
    {
      id: 'INS-004',
      type: 'opportunity',
      category: 'Seasonal Demand',
      title: 'Peak Season Approaching',
      description: 'Peak rental season (Dec-Feb) expected to show 10% increase in occupancy',
      impact: 'high',
      confidence: 90,
      actionable: true
    }
  ];

  const filteredForecasts = occupancyForecasts.filter(forecast => {
    const matchesSearch = forecast.propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         forecast.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || forecast.propertyType === selectedType;
    const matchesTimeframe = selectedTimeframe === 'all' || forecast.timeframe === selectedTimeframe;
    return matchesSearch && matchesType && matchesTimeframe;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'likely_renewal':
      case 'increasing':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'at_risk':
      case 'decreasing':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'expiring_soon':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'stable':
      case 'unknown':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Activity className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'apartment':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><Building className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'house':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Home className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'commercial':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><BarChart3 className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'office':
        return <Badge variant="outline" className="text-yellow-300 border-yellow-700"><Activity className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getInsightBadge = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <Badge variant="outline" className="text-green-300 border-green-700"><TrendingUp className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'risk':
        return <Badge variant="outline" className="text-destructive border-red-700"><AlertTriangle className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'trend':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><LineChart className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalProperties = occupancyForecasts.length;
  const averageOccupancy = occupancyForecasts.reduce((sum, f) => sum + f.currentOccupancy, 0) / totalProperties;
  const forecastedOccupancy = occupancyForecasts.reduce((sum, f) => sum + f.forecastedOccupancy, 0) / totalProperties;
  const expiringLeases = leaseExpirations.filter(l => l.daysUntilExpiration <= 30).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Occupancy Forecasting Dashboard</h2>
          <p className="text-warning/70 text-sm mt-1">AI-powered occupancy prediction and market intelligence</p>
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
              <Building className="h-4 w-4 text-warning" />
              Total Properties
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalProperties}</div>
            <div className="text-sm text-warning/70">Tracked properties</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-warning" />
              Current Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{averageOccupancy.toFixed(1)}%</div>
            <div className="text-sm text-warning/70">Average across portfolio</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-warning" />
              Forecasted Occupancy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{forecastedOccupancy.toFixed(1)}%</div>
            <div className="text-sm text-warning/70">3-month forecast</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-warning" />
              Expiring Leases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{expiringLeases}</div>
            <div className="text-sm text-warning/70">Within 30 days</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            Overview
          </TabsTrigger>
          <TabsTrigger value="forecasts" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <TrendingUp className="h-4 w-4 mr-2" />
            Forecasts
          </TabsTrigger>
          <TabsTrigger value="seasonal" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Calendar className="h-4 w-4 mr-2" />
            Seasonal
          </TabsTrigger>
          <TabsTrigger value="leases" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <CalendarDays className="h-4 w-4 mr-2" />
            Leases
          </TabsTrigger>
          <TabsTrigger value="insights" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Zap className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-warning" />
                  Top Performing Properties
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {occupancyForecasts.filter(f => f.changeType === 'increase').slice(0, 3).map((forecast) => (
                    <div key={forecast.id} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-sm font-medium">{forecast.propertyName}</span>
                        {getTypeBadge(forecast.propertyType)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70 mb-2">
                        <span>Current: {forecast.currentOccupancy}%</span>
                        <span>Forecast: {forecast.forecastedOccupancy}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70">
                        <span className="text-green-400">+{forecast.change}% change</span>
                        <span>Confidence: {forecast.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Properties at Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {occupancyForecasts.filter(f => f.changeType === 'decrease').slice(0, 3).map((forecast) => (
                    <div key={forecast.id} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-sm font-medium">{forecast.propertyName}</span>
                        {getTypeBadge(forecast.propertyType)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70 mb-2">
                        <span>Current: {forecast.currentOccupancy}%</span>
                        <span>Forecast: {forecast.forecastedOccupancy}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70">
                        <span className="text-destructive">{forecast.change}% change</span>
                        <span>Confidence: {forecast.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecasts">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Occupancy Forecasts</CardTitle>
              <CardDescription className="text-warning/70">
                AI-powered occupancy predictions by property
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search properties..."
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
                  <option value="apartment">Apartment</option>
                  <option value="house">House</option>
                  <option value="commercial">Commercial</option>
                  <option value="office">Office</option>
                </select>
                <select
                  value={selectedTimeframe}
                  onChange={(e) => setSelectedTimeframe(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Timeframes</option>
                  <option value="3 months">3 Months</option>
                  <option value="6 months">6 Months</option>
                  <option value="12 months">12 Months</option>
                </select>
              </div>

              {/* Forecasts List */}
              <div className="space-y-4">
                {filteredForecasts.map((forecast) => (
                  <div key={forecast.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{forecast.propertyName}</span>
                          <span className="text-warning/70 text-sm ml-2">{forecast.id}</span>
                          {getTypeBadge(forecast.propertyType)}
                        </div>
                        <div className="flex items-center gap-2">
                          {forecast.changeType === 'increase' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <ArrowUp className="h-3 w-3 mr-1" />
                              +{forecast.change}%
                            </Badge>
                          ) : (
                            <Badge className="bg-destructive/15 text-destructive border-red-300">
                              <ArrowDown className="h-3 w-3 mr-1" />
                              {forecast.change}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {forecast.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {forecast.timeframe}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Current: {forecast.currentOccupancy}%
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Forecast: {forecast.forecastedOccupancy}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Confidence: {forecast.confidence}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {forecast.occupiedUnits}/{forecast.totalUnits} units occupied
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {forecast.availableUnits} units available
                        </span>
                      </div>
                      <Progress value={forecast.forecastedOccupancy} className="h-2 mt-2" />
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

        <TabsContent value="seasonal">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Seasonal Patterns</CardTitle>
              <CardDescription className="text-warning/70">
                Historical seasonal occupancy trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {seasonalPatterns.map((pattern) => (
                  <div key={pattern.id} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-foreground font-medium">{pattern.season}</span>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(pattern.trend)}
                        <Badge variant="outline" className="text-warning/70 border-warning/30">
                          {pattern.months.join(', ')}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-3">
                      <div>
                        <div className="text-2xl font-bold text-foreground">{pattern.averageOccupancy}%</div>
                        <div className="text-xs text-warning/70">Average Occupancy</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-warning/70">Factors:</div>
                      {pattern.factors.map((factor, idx) => (
                        <div key={idx} className="text-xs text-warning/70 flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-400" />
                          {factor}
                        </div>
                      ))}
                    </div>
                    <Progress value={pattern.averageOccupancy} className="h-2 mt-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leases">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Lease Expirations</CardTitle>
              <CardDescription className="text-warning/70">
                Upcoming lease expirations and renewal predictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaseExpirations.map((lease) => (
                  <div key={lease.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{lease.tenantName}</span>
                          <span className="text-warning/70 text-sm ml-2">{lease.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(lease.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {lease.propertyName} - {lease.unit}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Ends: {lease.leaseEndDate.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {lease.daysUntilExpiration} days remaining
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Renewal: {lease.renewalProbability}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Potential Loss: KES {lease.estimatedRevenueLoss.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={lease.renewalProbability} className="h-2 mt-2" />
                    </div>
                    {lease.status === 'expiring_soon' && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Contact Tenant
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Market Insights</CardTitle>
              <CardDescription className="text-warning/70">
                AI-powered market intelligence and recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {marketInsights.map((insight) => (
                  <div key={insight.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{insight.title}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {insight.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getInsightBadge(insight.type)}
                          <Badge className="bg-[hsl(214_73%_48%)] text-white border-[hsl(214_73%_40%)]">
                            {insight.confidence}% confidence
                          </Badge>
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{insight.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Impact: {insight.impact}
                        </span>
                        {insight.actionable && (
                          <Badge className="bg-green-100 text-green-800 border-green-300">Actionable</Badge>
                        )}
                      </div>
                    </div>
                    {insight.actionable && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Take Action
                      </Button>
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

export default OccupancyForecastingDashboard;
