import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  Wrench, Search, Filter, Download, RefreshCw, Star, MapPin,
  Calendar, DollarSign, CheckCircle, AlertTriangle, Clock, User,
  Building, Activity, TrendingUp, Award, Shield, Phone, Mail,
  FileText, Briefcase, Settings, Zap, Target
} from 'lucide-react';

interface Contractor {
  id: string;
  name: string;
  company: string;
  specialty: string;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  activeJobs: number;
  location: string;
  availability: 'available' | 'busy' | 'unavailable';
  hourlyRate: number;
  verified: boolean;
  certified: boolean;
  responseTime: string;
  specialties: string[];
}

interface WorkOrder {
  id: string;
  contractorId: string | null;
  contractorName: string | null;
  propertyId: string;
  propertyName: string;
  unit: string;
  category: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  budget: number;
  estimatedCost: number | null;
  actualCost?: number;
  scheduledDate: Date | null;
  completedDate?: Date;
  createdDate: Date;
}

interface Bid {
  id: string;
  workOrderId: string;
  contractorId: string;
  contractorName: string;
  contractorRating: number;
  bidAmount: number;
  estimatedDuration: string;
  proposal: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  submittedDate: Date;
}

interface ContractorPerformance {
  contractorId: string;
  contractorName: string;
  onTimeCompletion: number;
  qualityScore: number;
  communicationScore: number;
  totalJobs: number;
  repeatClientRate: number;
  averageResponseTime: string;
}

const ContractorMarketplace = () => {
  const [activeTab, setActiveTab] = useState('contractors');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Mock data - in production, this would come from the contractor marketplace API
  const contractors: Contractor[] = [
    {
      id: 'CON-001',
      name: 'John Kamau',
      company: 'Kamau Plumbing Services',
      specialty: 'plumbing',
      rating: 4.8,
      reviewCount: 127,
      completedJobs: 145,
      activeJobs: 3,
      location: 'Nairobi CBD',
      availability: 'available',
      hourlyRate: 1500,
      verified: true,
      certified: true,
      responseTime: '2 hours',
      specialties: ['Plumbing', 'Pipe Repair', 'Installation']
    },
    {
      id: 'CON-002',
      name: 'Mary Wanjiku',
      company: 'Wanjiku Electrical',
      specialty: 'electrical',
      rating: 4.9,
      reviewCount: 98,
      completedJobs: 112,
      activeJobs: 5,
      location: 'Westlands',
      availability: 'busy',
      hourlyRate: 2000,
      verified: true,
      certified: true,
      responseTime: '1 hour',
      specialties: ['Electrical', 'Wiring', 'Panel Installation']
    },
    {
      id: 'CON-003',
      name: 'Peter Ochieng',
      company: 'Ochieng HVAC Solutions',
      specialty: 'hvac',
      rating: 4.7,
      reviewCount: 76,
      completedJobs: 89,
      activeJobs: 2,
      location: 'Karen',
      availability: 'available',
      hourlyRate: 2500,
      verified: true,
      certified: true,
      responseTime: '3 hours',
      specialties: ['HVAC', 'AC Repair', 'Ventilation']
    },
    {
      id: 'CON-004',
      name: 'Grace Njoroge',
      company: 'Njoroge General Repairs',
      specialty: 'general',
      rating: 4.5,
      reviewCount: 54,
      completedJobs: 67,
      activeJobs: 4,
      location: 'Eastlands',
      availability: 'available',
      hourlyRate: 1200,
      verified: false,
      certified: false,
      responseTime: '4 hours',
      specialties: ['General Repairs', 'Painting', 'Carpentry']
    },
    {
      id: 'CON-005',
      name: 'James Mwangi',
      company: 'Mwangi Security Systems',
      specialty: 'security',
      rating: 4.6,
      reviewCount: 43,
      completedJobs: 58,
      activeJobs: 1,
      location: 'Industrial Area',
      availability: 'available',
      hourlyRate: 1800,
      verified: true,
      certified: true,
      responseTime: '2 hours',
      specialties: ['Security Systems', 'CCTV', 'Access Control']
    }
  ];

  const workOrders: WorkOrder[] = [
    {
      id: 'WO-001',
      contractorId: 'CON-001',
      contractorName: 'John Kamau',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      unit: 'A-101',
      category: 'plumbing',
      description: 'Leaking faucet in bathroom',
      priority: 'medium',
      status: 'in_progress',
      budget: 5000,
      estimatedCost: 4500,
      scheduledDate: new Date('2026-06-05'),
      createdDate: new Date('2026-06-03')
    },
    {
      id: 'WO-002',
      contractorId: 'CON-002',
      contractorName: 'Mary Wanjiku',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      unit: 'B-201',
      category: 'electrical',
      description: 'Electrical panel inspection',
      priority: 'high',
      status: 'assigned',
      budget: 15000,
      estimatedCost: 12000,
      scheduledDate: new Date('2026-06-10'),
      createdDate: new Date('2026-06-02')
    },
    {
      id: 'WO-003',
      contractorId: null,
      contractorName: null,
      propertyId: 'PROP-003',
      propertyName: 'Garden View',
      unit: 'C-301',
      category: 'hvac',
      description: 'AC unit not cooling properly',
      priority: 'high',
      status: 'pending',
      budget: 10000,
      estimatedCost: null,
      scheduledDate: null,
      createdDate: new Date('2026-06-01')
    }
  ];

  const bids: Bid[] = [
    {
      id: 'BID-001',
      workOrderId: 'WO-003',
      contractorId: 'CON-003',
      contractorName: 'Peter Ochieng',
      contractorRating: 4.7,
      bidAmount: 8500,
      estimatedDuration: '2 hours',
      proposal: 'Will inspect and repair AC unit. Includes parts and labor.',
      status: 'pending',
      submittedDate: new Date('2026-06-02')
    },
    {
      id: 'BID-002',
      workOrderId: 'WO-003',
      contractorId: 'CON-005',
      contractorName: 'James Mwangi',
      contractorRating: 4.6,
      bidAmount: 9500,
      estimatedDuration: '3 hours',
      proposal: 'Comprehensive AC service with warranty.',
      status: 'pending',
      submittedDate: new Date('2026-06-03')
    }
  ];

  const contractorPerformance: ContractorPerformance[] = [
    {
      contractorId: 'CON-001',
      contractorName: 'John Kamau',
      onTimeCompletion: 94,
      qualityScore: 4.7,
      communicationScore: 4.8,
      totalJobs: 145,
      repeatClientRate: 78,
      averageResponseTime: '2 hours'
    },
    {
      contractorId: 'CON-002',
      contractorName: 'Mary Wanjiku',
      onTimeCompletion: 96,
      qualityScore: 4.9,
      communicationScore: 4.7,
      totalJobs: 112,
      repeatClientRate: 82,
      averageResponseTime: '1 hour'
    },
    {
      contractorId: 'CON-003',
      contractorName: 'Peter Ochieng',
      onTimeCompletion: 91,
      qualityScore: 4.6,
      communicationScore: 4.5,
      totalJobs: 89,
      repeatClientRate: 75,
      averageResponseTime: '3 hours'
    }
  ];

  const filteredContractors = contractors.filter(contractor => {
    const matchesSearch = contractor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contractor.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contractor.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'all' || contractor.specialty === selectedSpecialty;
    const matchesStatus = selectedStatus === 'all' || contractor.availability === selectedStatus;
    return matchesSearch && matchesSpecialty && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
      case 'completed':
      case 'accepted':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'busy':
      case 'in_progress':
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'unavailable':
      case 'cancelled':
      case 'rejected':
      case 'withdrawn':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'assigned':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Activity className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge className="bg-destructive text-white border-red-700">{priority}</Badge>;
      case 'high':
        return <Badge className="bg-warning text-white border-warning">{priority}</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-warning-foreground border-warning">{priority}</Badge>;
      case 'low':
        return <Badge className="bg-blue-500 text-white border-blue-600">{priority}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const totalContractors = contractors.length;
  const availableContractors = contractors.filter(c => c.availability === 'available').length;
  const activeWorkOrders = workOrders.filter(w => w.status === 'in_progress' || w.status === 'assigned').length;
  const pendingBids = bids.filter(b => b.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Contractor Marketplace</h2>
          <p className="text-warning/70 text-sm mt-1">Connect with verified contractors for maintenance and repairs</p>
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
              Total Contractors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalContractors}</div>
            <div className="text-sm text-warning/70">Registered contractors</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-warning" />
              Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{availableContractors}</div>
            <div className="text-sm text-warning/70">Ready for work</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-warning" />
              Active Work Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeWorkOrders}</div>
            <div className="text-sm text-warning/70">In progress</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-warning" />
              Pending Bids
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{pendingBids}</div>
            <div className="text-sm text-warning/70">Awaiting review</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="contractors" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Wrench className="h-4 w-4 mr-2" />
            Contractors
          </TabsTrigger>
          <TabsTrigger value="workorders" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Briefcase className="h-4 w-4 mr-2" />
            Work Orders
          </TabsTrigger>
          <TabsTrigger value="bids" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <FileText className="h-4 w-4 mr-2" />
            Bids
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Award className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contractors">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Contractor Directory</CardTitle>
              <CardDescription className="text-warning/70">
                Browse and connect with verified contractors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search contractors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Specialties</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="general">General</option>
                  <option value="security">Security</option>
                </select>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Availability</option>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              {/* Contractors List */}
              <div className="grid gap-4 md:grid-cols-2">
                {filteredContractors.map((contractor) => (
                  <div key={contractor.id} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-foreground font-medium">{contractor.name}</span>
                          {contractor.verified && (
                            <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Shield className="h-3 w-3 mr-1" />Verified</Badge>
                          )}
                          {contractor.certified && (
                            <Badge className="bg-green-100 text-green-800 border-green-300"><Award className="h-3 w-3 mr-1" />Certified</Badge>
                          )}
                        </div>
                        <div className="text-warning/70 text-sm">{contractor.company}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-foreground font-medium">{contractor.rating}</span>
                        <span className="text-warning/70 text-sm">({contractor.reviewCount})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {contractor.specialties.map((spec, idx) => (
                        <Badge key={idx} variant="outline" className="text-warning/70 border-warning/30 text-xs">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div className="flex items-center gap-2 text-warning/70">
                        <MapPin className="h-3 w-3" />
                        {contractor.location}
                      </div>
                      <div className="flex items-center gap-2 text-warning/70">
                        <Clock className="h-3 w-3" />
                        {contractor.responseTime}
                      </div>
                      <div className="flex items-center gap-2 text-warning/70">
                        <DollarSign className="h-3 w-3" />
                        KES {contractor.hourlyRate}/hr
                      </div>
                      <div className="flex items-center gap-2 text-warning/70">
                        <Briefcase className="h-3 w-3" />
                        {contractor.completedJobs} jobs
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {getStatusBadge(contractor.availability)}
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        View Profile
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workorders">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Work Orders</CardTitle>
              <CardDescription className="text-warning/70">
                Manage maintenance and repair work orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workOrders.map((workOrder) => (
                  <div key={workOrder.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{workOrder.description}</span>
                          <span className="text-warning/70 text-sm ml-2">{workOrder.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(workOrder.priority)}
                          {getStatusBadge(workOrder.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {workOrder.propertyName} - {workOrder.unit}
                        </span>
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" />
                          {workOrder.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        {workOrder.contractorName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {workOrder.contractorName}
                          </span>
                        )}
                        {workOrder.scheduledDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Scheduled: {workOrder.scheduledDate.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Budget: KES {workOrder.budget.toLocaleString()}
                        </span>
                        {workOrder.estimatedCost && (
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            Estimated: KES {workOrder.estimatedCost.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {workOrder.status === 'pending' && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Invite Bids
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bids">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Contractor Bids</CardTitle>
              <CardDescription className="text-warning/70">
                Review and manage contractor bids for work orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bids.map((bid) => (
                  <div key={bid.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{bid.contractorName}</span>
                          <span className="text-warning/70 text-sm ml-2">{bid.id}</span>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-warning/70 text-sm">{bid.contractorRating}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(bid.status)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{bid.proposal}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Bid: KES {bid.bidAmount.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Duration: {bid.estimatedDuration}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Submitted: {bid.submittedDate.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {bid.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="border-green-700 text-green-300 hover:bg-green-900/50">
                          Accept
                        </Button>
                        <Button variant="outline" size="sm" className="border-red-700 text-destructive hover:bg-destructive/20">
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Contractor Performance</CardTitle>
              <CardDescription className="text-warning/70">
                Track contractor performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contractorPerformance.map((perf) => (
                  <div key={perf.contractorId} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-foreground font-medium">{perf.contractorName}</span>
                      <Badge variant="outline" className="text-warning/70 border-warning/30">
                        {perf.totalJobs} jobs completed
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.onTimeCompletion}%</div>
                        <div className="text-xs text-warning/70">On-Time Completion</div>
                        <Progress value={perf.onTimeCompletion} className="h-2 mt-1" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.qualityScore}/5</div>
                        <div className="text-xs text-warning/70">Quality Score</div>
                        <Progress value={(perf.qualityScore / 5) * 100} className="h-2 mt-1" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.communicationScore}/5</div>
                        <div className="text-xs text-warning/70">Communication</div>
                        <Progress value={(perf.communicationScore / 5) * 100} className="h-2 mt-1" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.repeatClientRate}%</div>
                        <div className="text-xs text-warning/70">Repeat Clients</div>
                        <Progress value={perf.repeatClientRate} className="h-2 mt-1" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-warning/70">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Avg Response: {perf.averageResponseTime}
                      </span>
                    </div>
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

export default ContractorMarketplace;
