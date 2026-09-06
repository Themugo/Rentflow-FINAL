import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Lock, FileText, AlertTriangle, CheckCircle, Clock,
  Download, Upload, Plus, Search, Filter, Calendar,
  User, Shield, Eye, AlertCircle, Cookie, Scale,
  Globe, Mail, Phone, Ban, CheckSquare
} from 'lucide-react';

interface ConsentRecord {
  id: string;
  userId: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'cookies';
  purpose: string;
  status: 'granted' | 'revoked' | 'expired';
  grantedDate: Date;
  revokedDate?: Date;
  expiryDate?: Date;
  ipAddress: string;
}

interface DataSubjectRequest {
  id: string;
  type: 'access' | 'deletion' | 'correction' | 'portability' | 'objection';
  userId: string;
  userEmail: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  submittedDate: Date;
  completedDate?: Date;
  assignedTo: string;
}

interface PrivacyPolicy {
  id: string;
  version: string;
  effectiveDate: Date;
  status: 'active' | 'draft' | 'archived';
  lastReviewed: Date;
  nextReview: Date;
  changes: string[];
}

interface DataBreach {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers: number;
  status: 'detected' | 'investigating' | 'contained' | 'resolved';
  detectedDate: Date;
  resolvedDate?: Date;
  notifiedDate?: Date;
}

interface CookieConsent {
  id: string;
  category: 'necessary' | 'functional' | 'analytics' | 'marketing';
  name: string;
  description: string;
  status: 'accepted' | 'rejected';
  consentDate: Date;
}

const PrivacyComplianceCenter = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequestType, setSelectedRequestType] = useState<string>('all');

  // Mock data - in production, this would come from the privacy compliance API
  const consentRecords: ConsentRecord[] = [
    {
      id: 'CON-001',
      userId: 'USR-001',
      consentType: 'data_processing',
      purpose: 'Processing personal data for platform services',
      status: 'granted',
      grantedDate: new Date('2026-01-15'),
      expiryDate: new Date('2027-01-15'),
      ipAddress: '192.168.1.100'
    },
    {
      id: 'CON-002',
      userId: 'USR-002',
      consentType: 'marketing',
      purpose: 'Sending marketing communications',
      status: 'revoked',
      grantedDate: new Date('2026-02-01'),
      revokedDate: new Date('2026-05-20'),
      ipAddress: '192.168.1.101'
    },
    {
      id: 'CON-003',
      userId: 'USR-003',
      consentType: 'analytics',
      purpose: 'Usage analytics and improvement',
      status: 'granted',
      grantedDate: new Date('2026-03-10'),
      expiryDate: new Date('2027-03-10'),
      ipAddress: '192.168.1.102'
    },
    {
      id: 'CON-004',
      userId: 'USR-004',
      consentType: 'cookies',
      purpose: 'Cookie consent for website functionality',
      status: 'granted',
      grantedDate: new Date('2026-04-05'),
      ipAddress: '192.168.1.103'
    }
  ];

  const dataSubjectRequests: DataSubjectRequest[] = [
    {
      id: 'DSR-001',
      type: 'access',
      userId: 'USR-001',
      userEmail: 'user@example.com',
      description: 'Request for copy of all personal data',
      status: 'completed',
      submittedDate: new Date('2026-05-20'),
      completedDate: new Date('2026-05-25'),
      assignedTo: 'Data Protection Officer'
    },
    {
      id: 'DSR-002',
      type: 'deletion',
      userId: 'USR-002',
      userEmail: 'user2@example.com',
      description: 'Request to delete all personal data',
      status: 'in_progress',
      submittedDate: new Date('2026-06-01'),
      assignedTo: 'Data Steward'
    },
    {
      id: 'DSR-003',
      type: 'correction',
      userId: 'USR-003',
      userEmail: 'user3@example.com',
      description: 'Request to correct email address',
      status: 'pending',
      submittedDate: new Date('2026-06-02'),
      assignedTo: 'Unassigned'
    }
  ];

  const privacyPolicies: PrivacyPolicy[] = [
    {
      id: 'POL-001',
      version: '2.0',
      effectiveDate: new Date('2026-01-01'),
      status: 'active',
      lastReviewed: new Date('2026-05-15'),
      nextReview: new Date('2026-12-31'),
      changes: ['Updated data retention periods', 'Added cookie policy section', 'Updated contact information']
    },
    {
      id: 'POL-002',
      version: '1.9',
      effectiveDate: new Date('2025-06-01'),
      status: 'archived',
      lastReviewed: new Date('2025-12-31'),
      nextReview: new Date('2026-06-01'),
      changes: []
    }
  ];

  const dataBreaches: DataBreach[] = [
    {
      id: 'BR-001',
      type: 'Unauthorized Access',
      description: 'Unauthorized access attempt detected and blocked',
      severity: 'low',
      affectedUsers: 0,
      status: 'resolved',
      detectedDate: new Date('2026-05-28'),
      resolvedDate: new Date('2026-05-29'),
      notifiedDate: new Date('2026-05-29')
    },
    {
      id: 'BR-002',
      type: 'Data Exfiltration',
      description: 'Potential data exfiltration detected',
      severity: 'high',
      affectedUsers: 150,
      status: 'investigating',
      detectedDate: new Date('2026-06-01')
    }
  ];

  const cookieConsents: CookieConsent[] = [
    {
      id: 'CK-001',
      category: 'necessary',
      name: 'Essential Cookies',
      description: 'Required for website functionality',
      status: 'accepted',
      consentDate: new Date('2026-01-15')
    },
    {
      id: 'CK-002',
      category: 'functional',
      name: 'Functional Cookies',
      description: 'Enable enhanced features',
      status: 'accepted',
      consentDate: new Date('2026-01-15')
    },
    {
      id: 'CK-003',
      category: 'analytics',
      name: 'Analytics Cookies',
      description: 'Help improve website performance',
      status: 'accepted',
      consentDate: new Date('2026-01-15')
    },
    {
      id: 'CK-004',
      category: 'marketing',
      name: 'Marketing Cookies',
      description: 'Used for advertising',
      status: 'rejected',
      consentDate: new Date('2026-01-15')
    }
  ];

  const filteredRequests = dataSubjectRequests.filter(request => {
    const matchesSearch = request.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedRequestType === 'all' || request.type === selectedRequestType;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'granted':
      case 'accepted':
      case 'active':
      case 'completed':
      case 'resolved':
      case 'contained':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'revoked':
      case 'rejected':
      case 'archived':
        return <Badge className="bg-secondary-background text-gray-800 border-gray-300">{status}</Badge>;
      case 'pending':
      case 'detected':
      case 'in_progress':
      case 'investigating':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'expired':
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

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'access':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><Eye className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'deletion':
        return <Badge variant="outline" className="text-destructive border-red-700"><Ban className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'correction':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><FileText className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'portability':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Download className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'objection':
        return <Badge variant="outline" className="text-warning border-orange-700"><AlertTriangle className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalConsents = consentRecords.length;
  const activeConsents = consentRecords.filter(c => c.status === 'granted').length;
  const pendingRequests = dataSubjectRequests.filter(r => r.status === 'pending').length;
  const activeBreaches = dataBreaches.filter(b => b.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Privacy Compliance Center</h2>
          <p className="text-warning/70 text-sm mt-1">Manage privacy compliance and data subject rights</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-warning/30 text-warning/80 hover:bg-warning/8"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            Update Policy
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-warning" />
              Total Consents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalConsents}</div>
            <div className="text-sm text-warning/70">All consent records</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-warning" />
              Active Consents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeConsents}</div>
            <div className="text-sm text-warning/70">Currently granted</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-warning" />
              Pending Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{pendingRequests}</div>
            <div className="text-sm text-warning/70">Awaiting action</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Active Breaches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeBreaches}</div>
            <div className="text-sm text-warning/70">Under investigation</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            Overview
          </TabsTrigger>
          <TabsTrigger value="consents" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <CheckSquare className="h-4 w-4 mr-2" />
            Consents
          </TabsTrigger>
          <TabsTrigger value="requests" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <User className="h-4 w-4 mr-2" />
            Data Subject Requests
          </TabsTrigger>
          <TabsTrigger value="policy" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <FileText className="h-4 w-4 mr-2" />
            Privacy Policy
          </TabsTrigger>
          <TabsTrigger value="breaches" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Data Breaches
          </TabsTrigger>
          <TabsTrigger value="cookies" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Cookie className="h-4 w-4 mr-2" />
            Cookie Consents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Scale className="h-5 w-5 text-warning" />
                  Data Subject Rights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-warning" />
                      <span className="text-foreground text-sm">Right to Access</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <div className="flex items-center gap-2">
                      <Ban className="h-4 w-4 text-warning" />
                      <span className="text-foreground text-sm">Right to Deletion</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-warning" />
                      <span className="text-foreground text-sm">Right to Correction</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Enabled</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-warning" />
                      <span className="text-foreground text-sm">Right to Portability</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Enabled</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Shield className="h-5 w-5 text-warning" />
                  Compliance Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <span className="text-foreground text-sm">GDPR Compliance</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <span className="text-foreground text-sm">Data Protection Act</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <span className="text-foreground text-sm">Cookie Policy</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <span className="text-foreground text-sm">Privacy Policy</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Current</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="consents">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Consent Records</CardTitle>
              <CardDescription className="text-warning/70">
                Manage user consent records and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {consentRecords.map((consent) => (
                  <div key={consent.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium capitalize">{consent.consentType.replace('_', ' ')}</span>
                          <span className="text-warning/70 text-sm ml-2">{consent.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {consent.userId}
                          </Badge>
                        </div>
                        {getStatusBadge(consent.status)}
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{consent.purpose}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Granted: {consent.grantedDate.toLocaleDateString()}
                        </span>
                        {consent.expiryDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {consent.expiryDate.toLocaleDateString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {consent.ipAddress}
                        </span>
                      </div>
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

        <TabsContent value="requests">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Data Subject Requests</CardTitle>
              <CardDescription className="text-warning/70">
                Manage GDPR data subject rights requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedRequestType}
                  onChange={(e) => setSelectedRequestType(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Types</option>
                  <option value="access">Access</option>
                  <option value="deletion">Deletion</option>
                  <option value="correction">Correction</option>
                  <option value="portability">Portability</option>
                  <option value="objection">Objection</option>
                </select>
              </div>

              <div className="space-y-4">
                {filteredRequests.map((request) => (
                  <div key={request.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{request.userEmail}</span>
                          <span className="text-warning/70 text-sm ml-2">{request.id}</span>
                          {getRequestTypeBadge(request.type)}
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{request.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Assigned: {request.assignedTo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Submitted: {request.submittedDate.toLocaleDateString()}
                        </span>
                        {request.completedDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed: {request.completedDate.toLocaleDateString()}
                          </span>
                        )}
                      </div>
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

        <TabsContent value="policy">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Privacy Policy</CardTitle>
              <CardDescription className="text-warning/70">
                Manage privacy policy versions and reviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {privacyPolicies.map((policy) => (
                  <div key={policy.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">Privacy Policy v{policy.version}</span>
                          <span className="text-warning/70 text-sm ml-2">{policy.id}</span>
                        </div>
                        {getStatusBadge(policy.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Effective: {policy.effectiveDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next Review: {policy.nextReview.toLocaleDateString()}
                        </span>
                      </div>
                      {policy.changes.length > 0 && (
                        <div className="text-sm text-warning/70">
                          <span className="font-medium">Changes: </span>
                          {policy.changes.join(', ')}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breaches">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Data Breaches</CardTitle>
              <CardDescription className="text-warning/70">
                Track and manage data breach incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataBreaches.map((breach) => (
                  <div key={breach.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{breach.type}</span>
                          <span className="text-warning/70 text-sm ml-2">{breach.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(breach.severity)}
                          {getStatusBadge(breach.status)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{breach.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Affected: {breach.affectedUsers} users
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Detected: {breach.detectedDate.toLocaleDateString()}
                        </span>
                      </div>
                      {breach.notifiedDate && (
                        <div className="flex items-center gap-4 text-sm text-warning/70">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            Notified: {breach.notifiedDate.toLocaleDateString()}
                          </span>
                        </div>
                      )}
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

        <TabsContent value="cookies">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Cookie Consents</CardTitle>
              <CardDescription className="text-warning/70">
                Manage cookie consent categories and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cookieConsents.map((consent) => (
                  <div key={consent.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{consent.name}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {consent.category}
                          </Badge>
                        </div>
                        {getStatusBadge(consent.status)}
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{consent.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Consent Date: {consent.consentDate.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                      Configure
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

export default PrivacyComplianceCenter;
