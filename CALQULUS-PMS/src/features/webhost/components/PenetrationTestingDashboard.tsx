import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  Bug, AlertTriangle, CheckCircle, Clock, Download, Upload,
  Plus, Search, Filter, Calendar, User, Shield, Target,
  AlertCircle, TrendingUp, Activity, Zap, Lock, Eye
} from 'lucide-react';

interface PenetrationTest {
  id: string;
  name: string;
  type: 'black_box' | 'white_box' | 'gray_box';
  scope: string;
  methodology: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed';
  scheduledDate: Date;
  completedDate?: Date;
  performedBy: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface VulnerabilityFinding {
  id: string;
  testId: string;
  title: string;
  category: 'injection' | 'broken_authentication' | 'sensitive_data' | 'xml_external_entities' | 'broken_access_control' | 'security_misconfiguration' | 'cross_site_scripting' | 'insecure_deserialization' | 'components_with_vulnerabilities' | 'insufficient_logging';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  impact: string;
  remediation: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted';
  discoveredDate: Date;
  resolvedDate?: Date;
  assignedTo: string;
}

interface VulnerabilityScan {
  id: string;
  name: string;
  type: 'automated' | 'manual';
  target: string;
  configuration: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scheduledDate: Date;
  completedDate?: Date;
  findingsCount: number;
  scanDuration: string;
}

interface RemediationPlan {
  id: string;
  findingId: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  assignedTo: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed';
  completedDate?: Date;
}

const PenetrationTestingDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');

  // Mock data - in production, this would come from the penetration testing API
  const penetrationTests: PenetrationTest[] = [
    {
      id: 'PT-001',
      name: 'Annual Security Assessment 2026',
      type: 'black_box',
      scope: 'External facing systems and APIs',
      methodology: 'OWASP Top 10 + Custom',
      status: 'completed',
      scheduledDate: new Date('2026-05-01'),
      completedDate: new Date('2026-05-15'),
      performedBy: 'External Security Firm',
      findingsCount: 12,
      criticalCount: 0,
      highCount: 2,
      mediumCount: 5,
      lowCount: 5
    },
    {
      id: 'PT-002',
      name: 'Internal Network Assessment',
      type: 'white_box',
      scope: 'Internal network and systems',
      methodology: 'NIST SP 800-115',
      status: 'in_progress',
      scheduledDate: new Date('2026-06-01'),
      performedBy: 'Internal Security Team',
      findingsCount: 8,
      criticalCount: 1,
      highCount: 3,
      mediumCount: 3,
      lowCount: 1
    },
    {
      id: 'PT-003',
      name: 'Web Application Security Test',
      type: 'gray_box',
      scope: 'Main web application',
      methodology: 'OWASP ASVS Level 2',
      status: 'scheduled',
      scheduledDate: new Date('2026-07-01'),
      performedBy: 'External Security Firm',
      findingsCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0
    }
  ];

  const vulnerabilityFindings: VulnerabilityFinding[] = [
    {
      id: 'VF-001',
      testId: 'PT-001',
      title: 'SQL Injection in Login Form',
      category: 'injection',
      severity: 'high',
      description: 'SQL injection vulnerability discovered in login form parameter',
      impact: 'Potential unauthorized database access',
      remediation: 'Use parameterized queries and input validation',
      status: 'resolved',
      discoveredDate: new Date('2026-05-10'),
      resolvedDate: new Date('2026-05-20'),
      assignedTo: 'Development Team'
    },
    {
      id: 'VF-002',
      testId: 'PT-001',
      title: 'Missing Security Headers',
      category: 'security_misconfiguration',
      severity: 'medium',
      description: 'Missing security headers in HTTP responses',
      impact: 'Exposure to various attacks',
      remediation: 'Implement CSP, X-Frame-Options, and other security headers',
      status: 'in_progress',
      discoveredDate: new Date('2026-05-12'),
      assignedTo: 'DevOps Team'
    },
    {
      id: 'VF-003',
      testId: 'PT-002',
      title: 'Weak Password Policy',
      category: 'broken_authentication',
      severity: 'high',
      description: 'Password policy does not enforce complexity requirements',
      impact: 'Increased risk of brute force attacks',
      remediation: 'Implement strong password requirements and MFA',
      status: 'open',
      discoveredDate: new Date('2026-06-05'),
      assignedTo: 'Security Team'
    },
    {
      id: 'VF-004',
      testId: 'PT-002',
      title: 'Unencrypted Sensitive Data',
      category: 'sensitive_data',
      severity: 'critical',
      description: 'Sensitive data stored without encryption',
      impact: 'Data breach risk',
      remediation: 'Implement encryption at rest and in transit',
      status: 'in_progress',
      discoveredDate: new Date('2026-06-06'),
      assignedTo: 'Database Team'
    }
  ];

  const vulnerabilityScans: VulnerabilityScan[] = [
    {
      id: 'VS-001',
      name: 'Weekly Automated Scan',
      type: 'automated',
      target: 'Production Environment',
      configuration: 'OWASP ZAP + Nessus',
      status: 'completed',
      scheduledDate: new Date('2026-06-01'),
      completedDate: new Date('2026-06-01'),
      findingsCount: 5,
      scanDuration: '2 hours'
    },
    {
      id: 'VS-002',
      name: 'API Security Scan',
      type: 'automated',
      target: 'API Endpoints',
      configuration: 'Burp Suite',
      status: 'running',
      scheduledDate: new Date('2026-06-03'),
      findingsCount: 0,
      scanDuration: 'In progress'
    },
    {
      id: 'VS-003',
      name: 'Manual Code Review',
      type: 'manual',
      target: 'Authentication Module',
      configuration: 'Static analysis + Manual review',
      status: 'pending',
      scheduledDate: new Date('2026-06-10'),
      findingsCount: 0,
      scanDuration: 'N/A'
    }
  ];

  const remediationPlans: RemediationPlan[] = [
    {
      id: 'RP-001',
      findingId: 'VF-004',
      priority: 'critical',
      action: 'Implement AES-256 encryption for sensitive data',
      assignedTo: 'Database Team',
      dueDate: new Date('2026-06-15'),
      status: 'in_progress'
    },
    {
      id: 'RP-002',
      findingId: 'VF-003',
      priority: 'high',
      action: 'Implement strong password policy and MFA',
      assignedTo: 'Security Team',
      dueDate: new Date('2026-06-20'),
      status: 'pending'
    },
    {
      id: 'RP-003',
      findingId: 'VF-002',
      priority: 'medium',
      action: 'Add security headers to all HTTP responses',
      assignedTo: 'DevOps Team',
      dueDate: new Date('2026-06-25'),
      status: 'in_progress'
    }
  ];

  const filteredFindings = vulnerabilityFindings.filter(finding => {
    const matchesSearch = finding.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         finding.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'all' || finding.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'in_progress':
      case 'running':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'scheduled':
      case 'pending':
      case 'open':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'accepted':
        return <Badge className="bg-secondary-background text-gray-800 border-gray-300">{status}</Badge>;
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
      case 'info':
        return <Badge className="bg-secondary-foreground text-white border-gray-600">{severity}</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
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

  const totalFindings = vulnerabilityFindings.length;
  const openFindings = vulnerabilityFindings.filter(f => f.status === 'open').length;
  const criticalFindings = vulnerabilityFindings.filter(f => f.severity === 'critical' && f.status !== 'resolved').length;
  const resolvedFindings = vulnerabilityFindings.filter(f => f.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Penetration Testing Dashboard</h2>
          <p className="text-warning/70 text-sm mt-1">Manage security testing and vulnerability remediation</p>
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
            <Plus className="h-4 w-4 mr-2" />
            Schedule Test
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-warning" />
              Total Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalFindings}</div>
            <div className="text-sm text-warning/70">All vulnerabilities</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Open Findings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{openFindings}</div>
            <div className="text-sm text-warning/70">Awaiting remediation</div>
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
            <div className="text-3xl font-bold text-foreground">{criticalFindings}</div>
            <div className="text-sm text-warning/70">High priority</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-warning" />
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{resolvedFindings}</div>
            <div className="text-sm text-warning/70">Fixed vulnerabilities</div>
          </CardContent>
        </Card>
      </div>

      {/* Severity Distribution */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-warning" />
            Severity Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-32 text-warning/70 text-sm">Critical</div>
              <div className="flex-1 bg-secondary-background rounded-full h-3">
                <div className="bg-destructive h-3 rounded-full" style={{ width: `${(vulnerabilityFindings.filter(f => f.severity === 'critical').length / totalFindings) * 100}%` }} />
              </div>
              <div className="w-8 text-foreground text-sm">{vulnerabilityFindings.filter(f => f.severity === 'critical').length}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32 text-warning/70 text-sm">High</div>
              <div className="flex-1 bg-secondary-background rounded-full h-3">
                <div className="bg-warning h-3 rounded-full" style={{ width: `${(vulnerabilityFindings.filter(f => f.severity === 'high').length / totalFindings) * 100}%` }} />
              </div>
              <div className="w-8 text-foreground text-sm">{vulnerabilityFindings.filter(f => f.severity === 'high').length}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32 text-warning/70 text-sm">Medium</div>
              <div className="flex-1 bg-secondary-background rounded-full h-3">
                <div className="bg-warning h-3 rounded-full" style={{ width: `${(vulnerabilityFindings.filter(f => f.severity === 'medium').length / totalFindings) * 100}%` }} />
              </div>
              <div className="w-8 text-foreground text-sm">{vulnerabilityFindings.filter(f => f.severity === 'medium').length}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-32 text-warning/70 text-sm">Low</div>
              <div className="flex-1 bg-secondary-background rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${(vulnerabilityFindings.filter(f => f.severity === 'low').length / totalFindings) * 100}%` }} />
              </div>
              <div className="w-8 text-foreground text-sm">{vulnerabilityFindings.filter(f => f.severity === 'low').length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            Overview
          </TabsTrigger>
          <TabsTrigger value="tests" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Bug className="h-4 w-4 mr-2" />
            Penetration Tests
          </TabsTrigger>
          <TabsTrigger value="findings" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Vulnerabilities
          </TabsTrigger>
          <TabsTrigger value="scans" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Activity className="h-4 w-4 mr-2" />
            Scans
          </TabsTrigger>
          <TabsTrigger value="remediation" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Zap className="h-4 w-4 mr-2" />
            Remediation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-warning" />
                  Recent Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {penetrationTests.slice(0, 3).map((test) => (
                    <div key={test.id} className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                      <div>
                        <span className="text-foreground text-sm">{test.name}</span>
                        <div className="text-warning/70 text-xs">{test.type.replace('_', ' ')} - {test.findingsCount} findings</div>
                      </div>
                      {getStatusBadge(test.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Target className="h-5 w-5 text-warning" />
                  Critical Remediations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {remediationPlans
                    .filter(p => p.priority === 'critical' && p.status !== 'completed')
                    .slice(0, 3)
                    .map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                        <div>
                          <span className="text-foreground text-sm">{plan.action}</span>
                          <div className="text-warning/70 text-xs">Due: {plan.dueDate.toLocaleDateString()}</div>
                        </div>
                        {getStatusBadge(plan.status)}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tests">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Penetration Tests</CardTitle>
              <CardDescription className="text-warning/70">
                Manage scheduled and completed penetration tests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {penetrationTests.map((test) => (
                  <div key={test.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{test.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{test.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {test.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        {getStatusBadge(test.status)}
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{test.scope}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {test.methodology}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {test.performedBy}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled: {test.scheduledDate.toLocaleDateString()}
                        </span>
                        {test.completedDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed: {test.completedDate.toLocaleDateString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Bug className="h-3 w-3" />
                          {test.findingsCount} findings
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

        <TabsContent value="findings">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Vulnerability Findings</CardTitle>
              <CardDescription className="text-warning/70">
                Track and manage security vulnerabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search findings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="info">Info</option>
                </select>
              </div>

              {/* Findings List */}
              <div className="space-y-4">
                {filteredFindings.map((finding) => (
                  <div key={finding.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{finding.title}</span>
                          <span className="text-warning/70 text-sm ml-2">{finding.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {finding.category.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(finding.severity)}
                          {getStatusBadge(finding.status)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{finding.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Impact: {finding.impact}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Assigned: {finding.assignedTo}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Discovered: {finding.discoveredDate.toLocaleDateString()}
                        </span>
                        {finding.resolvedDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Resolved: {finding.resolvedDate.toLocaleDateString()}
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

        <TabsContent value="scans">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Vulnerability Scans</CardTitle>
              <CardDescription className="text-warning/70">
                Manage automated and manual vulnerability scans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vulnerabilityScans.map((scan) => (
                  <div key={scan.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{scan.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{scan.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {scan.type}
                          </Badge>
                        </div>
                        {getStatusBadge(scan.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {scan.target}
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {scan.configuration}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Scheduled: {scan.scheduledDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Duration: {scan.scanDuration}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bug className="h-3 w-3" />
                          {scan.findingsCount} findings
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

        <TabsContent value="remediation">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Remediation Plans</CardTitle>
              <CardDescription className="text-warning/70">
                Track vulnerability remediation progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {remediationPlans.map((plan) => (
                  <div key={plan.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{plan.action}</span>
                          <span className="text-warning/70 text-sm ml-2">{plan.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {plan.findingId}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(plan.priority)}
                          {getStatusBadge(plan.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Assigned: {plan.assignedTo}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {plan.dueDate.toLocaleDateString()}
                        </span>
                      </div>
                      {plan.completedDate && (
                        <div className="flex items-center gap-4 text-sm text-warning/70">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed: {plan.completedDate.toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                    {plan.status !== 'completed' && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Update Status
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

export default PenetrationTestingDashboard;
