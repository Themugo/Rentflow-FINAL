import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  Users, DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Search, Filter, Download, RefreshCw, Calendar, Building, Activity,
  Target, Heart, Star, Clock, ArrowUp, ArrowDown, Zap, Award
} from 'lucide-react';

interface TenantLTV {
  id: string;
  name: string;
  email: string;
  propertyId: string;
  propertyName: string;
  unit: string;
  ltv: number;
  retentionProbability: number;
  churnRisk: 'low' | 'medium' | 'high' | 'critical';
  acquisitionCost: number;
  monthlyRevenue: number;
  tenure: number;
  paymentHistory: 'excellent' | 'good' | 'fair' | 'poor';
  satisfactionScore: number;
  lastPaymentDate: Date;
  leaseEndDate: Date;
}

interface RetentionStrategy {
  id: string;
  tenantId: string;
  tenantName: string;
  strategy: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: number;
  status: 'proposed' | 'in_progress' | 'completed';
  implementationDate?: Date;
}

interface ChurnPrediction {
  id: string;
  tenantId: string;
  tenantName: string;
  churnProbability: number;
  riskFactors: string[];
  recommendedAction: string;
  timeframe: string;
}

interface LTVSegment {
  name: string;
  count: number;
  averageLTV: number;
  averageTenure: number;
  totalRevenue: number;
  characteristics: string[];
}

const TenantLTVAnalytics = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<string>('all');

  // Mock data - in production, this would come from the tenant LTV analytics API
  const tenantLTVs: TenantLTV[] = [
    {
      id: 'TEN-001',
      name: 'John Kamau',
      email: 'john.kamau@example.com',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      unit: 'A-101',
      ltv: 540000,
      retentionProbability: 92,
      churnRisk: 'low',
      acquisitionCost: 15000,
      monthlyRevenue: 15000,
      tenure: 36,
      paymentHistory: 'excellent',
      satisfactionScore: 4.8,
      lastPaymentDate: new Date('2026-06-01'),
      leaseEndDate: new Date('2027-05-31')
    },
    {
      id: 'TEN-002',
      name: 'Mary Wanjiku',
      email: 'mary.wanjiku@example.com',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      unit: 'A-102',
      ltv: 432000,
      retentionProbability: 78,
      churnRisk: 'medium',
      acquisitionCost: 12000,
      monthlyRevenue: 12000,
      tenure: 24,
      paymentHistory: 'good',
      satisfactionScore: 4.2,
      lastPaymentDate: new Date('2026-06-01'),
      leaseEndDate: new Date('2026-12-31')
    },
    {
      id: 'TEN-003',
      name: 'Peter Ochieng',
      email: 'peter.ochieng@example.com',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      unit: 'B-201',
      ltv: 288000,
      retentionProbability: 45,
      churnRisk: 'high',
      acquisitionCost: 10000,
      monthlyRevenue: 8000,
      tenure: 12,
      paymentHistory: 'fair',
      satisfactionScore: 3.5,
      lastPaymentDate: new Date('2026-05-28'),
      leaseEndDate: new Date('2026-08-31')
    },
    {
      id: 'TEN-004',
      name: 'Grace Njoroge',
      email: 'grace.njoroge@example.com',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      unit: 'B-202',
      ltv: 720000,
      retentionProbability: 95,
      churnRisk: 'low',
      acquisitionCost: 18000,
      monthlyRevenue: 20000,
      tenure: 48,
      paymentHistory: 'excellent',
      satisfactionScore: 4.9,
      lastPaymentDate: new Date('2026-06-01'),
      leaseEndDate: new Date('2028-05-31')
    },
    {
      id: 'TEN-005',
      name: 'James Mwangi',
      email: 'james.mwangi@example.com',
      propertyId: 'PROP-003',
      propertyName: 'Garden View',
      unit: 'C-301',
      ltv: 180000,
      retentionProbability: 25,
      churnRisk: 'critical',
      acquisitionCost: 8000,
      monthlyRevenue: 5000,
      tenure: 6,
      paymentHistory: 'poor',
      satisfactionScore: 2.8,
      lastPaymentDate: new Date('2026-05-15'),
      leaseEndDate: new Date('2026-07-31')
    }
  ];

  const retentionStrategies: RetentionStrategy[] = [
    {
      id: 'STRAT-001',
      tenantId: 'TEN-005',
      tenantName: 'James Mwangi',
      strategy: 'Offer rent discount and payment plan',
      priority: 'high',
      estimatedImpact: 35,
      status: 'proposed'
    },
    {
      id: 'STRAT-002',
      tenantId: 'TEN-003',
      tenantName: 'Peter Ochieng',
      strategy: 'Upgrade unit and improve amenities',
      priority: 'medium',
      estimatedImpact: 25,
      status: 'in_progress',
      implementationDate: new Date('2026-06-05')
    },
    {
      id: 'STRAT-003',
      tenantId: 'TEN-002',
      tenantName: 'Mary Wanjiku',
      strategy: 'Lease renewal incentive',
      priority: 'medium',
      estimatedImpact: 20,
      status: 'proposed'
    }
  ];

  const churnPredictions: ChurnPrediction[] = [
    {
      id: 'CHRN-001',
      tenantId: 'TEN-005',
      tenantName: 'James Mwangi',
      churnProbability: 75,
      riskFactors: ['Late payments', 'Low satisfaction', 'Short tenure'],
      recommendedAction: 'Immediate intervention - offer payment plan and rent discount',
      timeframe: '30 days'
    },
    {
      id: 'CHRN-002',
      tenantId: 'TEN-003',
      tenantName: 'Peter Ochieng',
      churnProbability: 55,
      riskFactors: ['Fair payment history', 'Medium satisfaction', 'Lease expiring soon'],
      recommendedAction: 'Proactive engagement - discuss lease renewal and improvements',
      timeframe: '60 days'
    }
  ];

  const ltvSegments: LTVSegment[] = [
    {
      name: 'High Value',
      count: 2,
      averageLTV: 630000,
      averageTenure: 42,
      totalRevenue: 35000,
      characteristics: ['Excellent payment history', 'High satisfaction', 'Long tenure']
    },
    {
      name: 'Medium Value',
      count: 2,
      averageLTV: 360000,
      averageTenure: 30,
      totalRevenue: 20000,
      characteristics: ['Good payment history', 'Medium satisfaction', 'Medium tenure']
    },
    {
      name: 'At Risk',
      count: 1,
      averageLTV: 180000,
      averageTenure: 6,
      totalRevenue: 5000,
      characteristics: ['Poor payment history', 'Low satisfaction', 'Short tenure']
    }
  ];

  const filteredTenants = tenantLTVs.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.propertyName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRisk = selectedRisk === 'all' || tenant.churnRisk === selectedRisk;
    const matchesPayment = selectedPayment === 'all' || tenant.paymentHistory === selectedPayment;
    return matchesSearch && matchesRisk && matchesPayment;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'completed':
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'good':
      case 'in_progress':
      case 'medium':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Activity className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'fair':
      case 'proposed':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'poor':
      case 'critical':
      case 'high':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-destructive text-white border-red-700">{priority}</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-white border-warning">{priority}</Badge>;
      case 'low':
        return <Badge className="bg-blue-500 text-white border-blue-600">{priority}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const totalTenants = tenantLTVs.length;
  const totalLTV = tenantLTVs.reduce((sum, t) => sum + t.ltv, 0);
  const averageRetention = tenantLTVs.reduce((sum, t) => sum + t.retentionProbability, 0) / totalTenants;
  const highRiskTenants = tenantLTVs.filter(t => t.churnRisk === 'high' || t.churnRisk === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tenant LTV Analytics</h2>
          <p className="text-warning/70 text-sm mt-1">Customer lifetime value and retention intelligence</p>
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
              <Users className="h-4 w-4 text-warning" />
              Total Tenants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalTenants}</div>
            <div className="text-sm text-warning/70">Active tenants</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-warning" />
              Total LTV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">KES {totalLTV.toLocaleString()}</div>
            <div className="text-sm text-warning/70">Lifetime value</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-warning" />
              Avg Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{averageRetention.toFixed(1)}%</div>
            <div className="text-sm text-warning/70">Retention probability</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              High Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{highRiskTenants}</div>
            <div className="text-sm text-warning/70">Churn risk</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            Overview
          </TabsTrigger>
          <TabsTrigger value="tenants" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Users className="h-4 w-4 mr-2" />
            Tenants
          </TabsTrigger>
          <TabsTrigger value="segments" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Target className="h-4 w-4 mr-2" />
            Segments
          </TabsTrigger>
          <TabsTrigger value="strategies" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Zap className="h-4 w-4 mr-2" />
            Strategies
          </TabsTrigger>
          <TabsTrigger value="churn" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <TrendingDown className="h-4 w-4 mr-2" />
            Churn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Award className="h-5 w-5 text-warning" />
                  High Value Tenants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tenantLTVs.filter(t => t.ltv > 500000).slice(0, 3).map((tenant) => (
                    <div key={tenant.id} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-sm font-medium">{tenant.name}</span>
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Star className="h-3 w-3 mr-1" />High Value</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70 mb-2">
                        <span>LTV: KES {tenant.ltv.toLocaleString()}</span>
                        <span>Tenure: {tenant.tenure} months</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70">
                        <span>Retention: {tenant.retentionProbability}%</span>
                        {getStatusBadge(tenant.paymentHistory)}
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
                  At-Risk Tenants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tenantLTVs.filter(t => t.churnRisk === 'high' || t.churnRisk === 'critical').slice(0, 3).map((tenant) => (
                    <div key={tenant.id} className="p-3 bg-secondary-background/60 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-foreground text-sm font-medium">{tenant.name}</span>
                        {getStatusBadge(tenant.churnRisk)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70 mb-2">
                        <span>Churn Risk: {100 - tenant.retentionProbability}%</span>
                        <span>Satisfaction: {tenant.satisfactionScore}/5</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-warning/70">
                        <span>LTV: KES {tenant.ltv.toLocaleString()}</span>
                        {getStatusBadge(tenant.paymentHistory)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tenants">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Tenant LTV Analysis</CardTitle>
              <CardDescription className="text-warning/70">
                Detailed lifetime value and retention metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search tenants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedRisk}
                  onChange={(e) => setSelectedRisk(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Risks</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <select
                  value={selectedPayment}
                  onChange={(e) => setSelectedPayment(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Payment History</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>

              {/* Tenants List */}
              <div className="space-y-4">
                {filteredTenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{tenant.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{tenant.id}</span>
                          {tenant.ltv > 500000 && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 ml-2"><Star className="h-3 w-3 mr-1" />High Value</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(tenant.churnRisk)}
                          {getStatusBadge(tenant.paymentHistory)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {tenant.propertyName} - {tenant.unit}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Monthly: KES {tenant.monthlyRevenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          LTV: KES {tenant.ltv.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          Retention: {tenant.retentionProbability}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Tenure: {tenant.tenure} months
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Satisfaction: {tenant.satisfactionScore}/5
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Acquisition Cost: KES {tenant.acquisitionCost.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Lease Ends: {tenant.leaseEndDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Last Payment: {tenant.lastPaymentDate.toLocaleDateString()}
                        </span>
                      </div>
                      <Progress value={tenant.retentionProbability} className="h-2 mt-2" />
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

        <TabsContent value="segments">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Tenant Segments</CardTitle>
              <CardDescription className="text-warning/70">
                LTV-based tenant segmentation analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ltvSegments.map((segment) => (
                  <div key={segment.name} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-foreground font-medium">{segment.name}</span>
                      <Badge variant="outline" className="text-warning/70 border-warning/30">
                        {segment.count} tenants
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="text-2xl font-bold text-foreground">KES {segment.averageLTV.toLocaleString()}</div>
                        <div className="text-xs text-warning/70">Avg LTV</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{segment.averageTenure} mo</div>
                        <div className="text-xs text-warning/70">Avg Tenure</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">KES {segment.totalRevenue.toLocaleString()}</div>
                        <div className="text-xs text-warning/70">Monthly Revenue</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{segment.count}</div>
                        <div className="text-xs text-warning/70">Tenants</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {segment.characteristics.map((char, idx) => (
                        <div key={idx} className="text-xs text-warning/70 flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-400" />
                          {char}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Retention Strategies</CardTitle>
              <CardDescription className="text-warning/70">
                AI-powered retention recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {retentionStrategies.map((strategy) => (
                  <div key={strategy.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{strategy.tenantName}</span>
                          <span className="text-warning/70 text-sm ml-2">{strategy.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(strategy.priority)}
                          {getStatusBadge(strategy.status)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{strategy.strategy}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Estimated Impact: {strategy.estimatedImpact}% retention improvement
                        </span>
                        {strategy.implementationDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Started: {strategy.implementationDate.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {strategy.status === 'proposed' && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Implement
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="churn">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Churn Predictions</CardTitle>
              <CardDescription className="text-warning/70">
                AI-powered churn risk analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {churnPredictions.map((prediction) => (
                  <div key={prediction.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{prediction.tenantName}</span>
                          <span className="text-warning/70 text-sm ml-2">{prediction.id}</span>
                        </div>
                        <Badge className="bg-destructive text-white border-red-700">
                          {prediction.churnProbability}% churn risk
                        </Badge>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{prediction.recommendedAction}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Timeframe: {prediction.timeframe}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-warning/70">Risk Factors:</div>
                        {prediction.riskFactors.map((factor, idx) => (
                          <div key={idx} className="text-xs text-warning/70 flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            {factor}
                          </div>
                        ))}
                      </div>
                      <Progress value={prediction.churnProbability} className="h-2 mt-2" />
                    </div>
                    <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                      Take Action
                    </Button>
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

export default TenantLTVAnalytics;
