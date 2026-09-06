import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Progress } from '@/shared/components/ui/progress';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock,
  Download, RefreshCw, Search, Filter, Calendar, DollarSign,
  Users, Building, Activity, Target, Zap, Shield, Eye
} from 'lucide-react';

interface KPI {
  id: string;
  name: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease';
  target: number;
  status: 'on_track' | 'at_risk' | 'off_track';
  category: 'financial' | 'operational' | 'strategic';
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'financial' | 'operational' | 'compliance' | 'security';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: Date;
  status: 'active' | 'acknowledged' | 'resolved';
  assignedTo?: string;
}

interface Insight {
  id: string;
  type: 'opportunity' | 'risk' | 'recommendation';
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
  actionable: boolean;
  timestamp: Date;
}

const ExecutiveIntelligenceDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock data - in production, this would come from the executive intelligence analytics API
  const kpis: KPI[] = [
    {
      id: 'KPI-001',
      name: 'Total Revenue',
      value: 12500000,
      change: 15.2,
      changeType: 'increase',
      target: 15000000,
      status: 'on_track',
      category: 'financial'
    },
    {
      id: 'KPI-002',
      name: 'Occupancy Rate',
      value: 87.5,
      change: 3.2,
      changeType: 'increase',
      target: 90,
      status: 'on_track',
      category: 'operational'
    },
    {
      id: 'KPI-003',
      name: 'Tenant Retention',
      value: 92.3,
      change: -1.5,
      changeType: 'decrease',
      target: 95,
      status: 'at_risk',
      category: 'operational'
    },
    {
      id: 'KPI-004',
      name: 'Collection Rate',
      value: 94.7,
      change: 2.1,
      changeType: 'increase',
      target: 95,
      status: 'on_track',
      category: 'financial'
    },
    {
      id: 'KPI-005',
      name: 'Maintenance Response Time',
      value: 24,
      change: -8.3,
      changeType: 'decrease',
      target: 18,
      status: 'off_track',
      category: 'operational'
    },
    {
      id: 'KPI-006',
      name: 'Customer Satisfaction',
      value: 4.2,
      change: 0.3,
      changeType: 'increase',
      target: 4.5,
      status: 'on_track',
      category: 'strategic'
    }
  ];

  const alerts: Alert[] = [
    {
      id: 'ALT-001',
      type: 'critical',
      category: 'financial',
      title: 'Revenue Below Target',
      description: 'Monthly revenue is 12% below target due to increased vacancies',
      severity: 'high',
      timestamp: new Date('2026-06-03T10:30:00'),
      status: 'active',
      assignedTo: 'Finance Director'
    },
    {
      id: 'ALT-002',
      type: 'warning',
      category: 'operational',
      title: 'Maintenance Backlog Increasing',
      description: 'Maintenance backlog has increased by 25% in the last month',
      severity: 'medium',
      timestamp: new Date('2026-06-02T14:45:00'),
      status: 'active',
      assignedTo: 'Operations Manager'
    },
    {
      id: 'ALT-003',
      type: 'info',
      category: 'compliance',
      title: 'SOC2 Audit Scheduled',
      description: 'Annual SOC2 compliance audit scheduled for next month',
      severity: 'low',
      timestamp: new Date('2026-06-01T09:00:00'),
      status: 'active'
    },
    {
      id: 'ALT-004',
      type: 'warning',
      category: 'security',
      title: 'Unusual Login Activity Detected',
      description: 'Multiple failed login attempts detected from unknown IP addresses',
      severity: 'high',
      timestamp: new Date('2026-06-03T08:15:00'),
      status: 'active',
      assignedTo: 'Security Team'
    }
  ];

  const insights: Insight[] = [
    {
      id: 'INS-001',
      type: 'opportunity',
      category: 'Revenue Optimization',
      title: 'Increase Rent in High-Demand Areas',
      description: 'Properties in Nairobi CBD show 15% higher demand. Consider rent increase of 5-8%.',
      impact: 'high',
      confidence: 85,
      actionable: true,
      timestamp: new Date('2026-06-03T11:00:00')
    },
    {
      id: 'INS-002',
      type: 'risk',
      category: 'Tenant Churn',
      title: 'High Churn Risk in Property Group A',
      description: 'Properties in Group A show 20% higher churn risk due to aging infrastructure.',
      impact: 'high',
      confidence: 78,
      actionable: true,
      timestamp: new Date('2026-06-02T16:30:00')
    },
    {
      id: 'INS-003',
      type: 'recommendation',
      category: 'Cost Reduction',
      title: 'Optimize Utility Consumption',
      description: 'Implement smart meters to reduce utility costs by estimated 12%.',
      impact: 'medium',
      confidence: 72,
      actionable: true,
      timestamp: new Date('2026-06-01T13:45:00')
    },
    {
      id: 'INS-004',
      type: 'opportunity',
      category: 'Market Expansion',
      title: 'Expand to Mombasa Market',
      description: 'Mombasa market shows strong growth potential with lower competition.',
      impact: 'high',
      confidence: 65,
      actionable: true,
      timestamp: new Date('2026-05-31T10:00:00')
    }
  ];

  const filteredAlerts = alerts.filter(alert => {
    return selectedCategory === 'all' || alert.category === selectedCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_track':
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'at_risk':
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><AlertTriangle className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'off_track':
      case 'critical':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'active':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Activity className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'acknowledged':
        return <Badge className="bg-warning/15 text-warning border-warning/25"><Eye className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'info':
        return <Badge className="bg-secondary-background text-gray-800 border-gray-300">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge className="bg-destructive text-white border-red-700">{severity}</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-white border-warning">{severity}</Badge>;
      case 'low':
        return <Badge className="bg-blue-500 text-white border-blue-600">{severity}</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <Badge variant="outline" className="text-green-300 border-green-700"><TrendingUp className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'risk':
        return <Badge variant="outline" className="text-destructive border-red-700"><AlertTriangle className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'recommendation':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><Target className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalAlerts = alerts.length;
  const activeAlerts = alerts.filter(a => a.status === 'active').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'high' && a.status === 'active').length;
  const actionableInsights = insights.filter(i => i.actionable).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Executive Intelligence Dashboard</h2>
          <p className="text-warning/70 text-sm mt-1">AI-powered insights and strategic analytics</p>
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
              <Activity className="h-4 w-4 text-warning" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeAlerts}</div>
            <div className="text-sm text-warning/70">Requiring attention</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{criticalAlerts}</div>
            <div className="text-sm text-warning/70">High priority</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-warning" />
              Actionable Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{actionableInsights}</div>
            <div className="text-sm text-warning/70">Ready to act</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-warning" />
              KPIs On Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{kpis.filter(k => k.status === 'on_track').length}</div>
            <div className="text-sm text-warning/70">of {kpis.length} total</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            Overview
          </TabsTrigger>
          <TabsTrigger value="kpis" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Target className="h-4 w-4 mr-2" />
            KPIs
          </TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Alerts
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
                  Top Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.filter(i => i.type === 'opportunity').slice(0, 3).map((insight) => (
                    <div key={insight.id} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-sm font-medium">{insight.title}</span>
                        {getSeverityBadge(insight.impact)}
                      </div>
                      <p className="text-warning/70 text-xs mb-2">{insight.description}</p>
                      <div className="flex items-center gap-2 text-xs text-warning/70">
                        <span>Confidence: {insight.confidence}%</span>
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
                  Top Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.filter(i => i.type === 'risk').slice(0, 3).map((insight) => (
                    <div key={insight.id} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-sm font-medium">{insight.title}</span>
                        {getSeverityBadge(insight.impact)}
                      </div>
                      <p className="text-warning/70 text-xs mb-2">{insight.description}</p>
                      <div className="flex items-center gap-2 text-xs text-warning/70">
                        <span>Confidence: {insight.confidence}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="kpis">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Key Performance Indicators</CardTitle>
              <CardDescription className="text-warning/70">
                Track strategic and operational metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpis.map((kpi) => (
                  <div key={kpi.id} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-foreground font-medium">{kpi.name}</span>
                        <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                          {kpi.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(kpi.status)}
                        <span className={`text-sm ${kpi.changeType !== 'increase' ? 'text-destructive' : kpi.category === 'financial' ? 'text-foreground' : 'text-success'}`}>
                          {kpi.changeType === 'increase' ? <TrendingUp className="h-4 w-4 inline mr-1" /> : <TrendingDown className="h-4 w-4 inline mr-1" />}
                          {kpi.change}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-2xl font-bold text-foreground">
                        {kpi.category === 'financial' ? `KES ${kpi.value.toLocaleString()}` : kpi.value}
                      </span>
                      <span className="text-warning/70 text-sm">Target: {kpi.category === 'financial' ? `KES ${kpi.target.toLocaleString()}` : kpi.target}</span>
                    </div>
                    <Progress value={(kpi.value / kpi.target) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Alerts & Notifications</CardTitle>
              <CardDescription className="text-warning/70">
                Monitor critical issues and warnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filter */}
              <div className="mb-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Categories</option>
                  <option value="financial">Financial</option>
                  <option value="operational">Operational</option>
                  <option value="compliance">Compliance</option>
                  <option value="security">Security</option>
                </select>
              </div>

              <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{alert.title}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {alert.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(alert.type)}
                          {getSeverityBadge(alert.severity)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{alert.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {alert.timestamp.toLocaleString()}
                        </span>
                        {alert.assignedTo && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {alert.assignedTo}
                          </span>
                        )}
                      </div>
                    </div>
                    {alert.status === 'active' && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Acknowledge
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
              <CardTitle className="text-foreground">AI-Powered Insights</CardTitle>
              <CardDescription className="text-warning/70">
                Data-driven recommendations and opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.map((insight) => (
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
                          {getTypeBadge(insight.type)}
                          {getSeverityBadge(insight.impact)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{insight.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Confidence: {insight.confidence}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {insight.timestamp.toLocaleDateString()}
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

export default ExecutiveIntelligenceDashboard;
