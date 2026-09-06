// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Progress } from '@/shared/components/ui/progress';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  ShieldCheck, FileText, AlertTriangle, CheckCircle, Clock,
  Download, Upload, Plus, Search, Filter, TrendingUp,
  Calendar, User, Building, Activity, AlertCircle
} from 'lucide-react';

interface SOC2Control {
  id: string;
  name: string;
  category: 'security' | 'availability' | 'processing_integrity' | 'confidentiality' | 'privacy';
  description: string;
  status: 'implemented' | 'partial' | 'not-implemented';
  lastAssessed: Date;
  nextAssessment: Date;
  evidenceCount: number;
  responsible: string;
}

interface SOC2Evidence {
  id: string;
  controlId: string;
  type: string;
  description: string;
  uploadDate: Date;
  uploadedBy: string;
  fileUrl: string;
}

interface SOC2Incident {
  id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  reportedDate: Date;
  resolvedDate?: Date;
  reportedBy: string;
}

const SOC2ComplianceDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock data - in production, this would come from the SOC2 compliance API
  const controls: SOC2Control[] = [
    {
      id: 'CC1.1',
      name: 'Access Control Program',
      category: 'security',
      description: 'Implement a comprehensive access control program',
      status: 'implemented',
      lastAssessed: new Date('2026-05-15'),
      nextAssessed: new Date('2026-08-15'),
      evidenceCount: 8,
      responsible: 'CISO'
    },
    {
      id: 'CC2.1',
      name: 'System Monitoring',
      category: 'availability',
      description: 'Monitor systems for availability and performance',
      status: 'implemented',
      lastAssessed: new Date('2026-05-20'),
      nextAssessed: new Date('2026-08-20'),
      evidenceCount: 12,
      responsible: 'DevOps Lead'
    },
    {
      id: 'CC3.1',
      name: 'Data Integrity',
      category: 'processing_integrity',
      description: 'Ensure data integrity throughout processing',
      status: 'partial',
      lastAssessed: new Date('2026-05-10'),
      nextAssessed: new Date('2026-08-10'),
      evidenceCount: 5,
      responsible: 'Data Engineer'
    },
    {
      id: 'CC4.1',
      name: 'Data Encryption',
      category: 'confidentiality',
      description: 'Encrypt data at rest and in transit',
      status: 'implemented',
      lastAssessed: new Date('2026-05-25'),
      nextAssessed: new Date('2026-08-25'),
      evidenceCount: 10,
      responsible: 'Security Engineer'
    },
    {
      id: 'CC5.1',
      name: 'Privacy Policy',
      category: 'privacy',
      description: 'Maintain and enforce privacy policy',
      status: 'implemented',
      lastAssessed: new Date('2026-05-22'),
      nextAssessed: new Date('2026-08-22'),
      evidenceCount: 6,
      responsible: 'Legal Counsel'
    },
    {
      id: 'CC6.1',
      name: 'Incident Response',
      category: 'security',
      description: 'Implement incident response procedures',
      status: 'not-implemented',
      lastAssessed: new Date('2026-04-15'),
      nextAssessed: new Date('2026-07-15'),
      evidenceCount: 0,
      responsible: 'CISO'
    }
  ];

  const evidence: SOC2Evidence[] = [
    {
      id: 'EV-001',
      controlId: 'CC1.1',
      type: 'Policy Document',
      description: 'Access Control Policy v2.0',
      uploadDate: new Date('2026-05-15'),
      uploadedBy: 'CISO',
      fileUrl: '/documents/access-control-policy.pdf'
    },
    {
      id: 'EV-002',
      controlId: 'CC2.1',
      type: 'Monitoring Report',
      description: 'System Availability Report - May 2026',
      uploadDate: new Date('2026-06-01'),
      uploadedBy: 'DevOps Lead',
      fileUrl: '/documents/availability-report-may.pdf'
    },
    {
      id: 'EV-003',
      controlId: 'CC4.1',
      type: 'Configuration Document',
      description: 'Encryption Configuration Standards',
      uploadDate: new Date('2026-05-25'),
      uploadedBy: 'Security Engineer',
      fileUrl: '/documents/encryption-config.pdf'
    }
  ];

  const incidents: SOC2Incident[] = [
    {
      id: 'INC-001',
      type: 'Unauthorized Access Attempt',
      description: 'Multiple failed login attempts detected from IP 192.168.1.100',
      severity: 'medium',
      status: 'resolved',
      reportedDate: new Date('2026-05-28'),
      resolvedDate: new Date('2026-05-29'),
      reportedBy: 'Security Analyst'
    },
    {
      id: 'INC-002',
      type: 'Service Outage',
      description: 'Database service unavailable for 2 hours',
      severity: 'high',
      status: 'resolved',
      reportedDate: new Date('2026-05-20'),
      resolvedDate: new Date('2026-05-20'),
      reportedBy: 'DevOps Engineer'
    }
  ];

  const filteredControls = controls.filter(control => {
    const matchesSearch = control.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         control.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || control.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'implemented':
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'partial':
      case 'investigating':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'not-implemented':
      case 'open':
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'security':
        return 'text-[hsl(214_73%_58%)]';
      case 'availability':
        return 'text-green-400';
      case 'processing_integrity':
        return 'text-warning';
      case 'confidentiality':
        return 'text-warning';
      case 'privacy':
        return 'text-[hsl(38_52%_55%)]';
      default:
        return 'text-gray-400';
    }
  };

  const overallScore = Math.round(
    (controls.filter(c => c.status === 'implemented').length / controls.length) * 100
  );

  const categoryScores = {
    security: controls.filter(c => c.category === 'security' && c.status === 'implemented').length / controls.filter(c => c.category === 'security').length * 100,
    availability: controls.filter(c => c.category === 'availability' && c.status === 'implemented').length / controls.filter(c => c.category === 'availability').length * 100,
    processing_integrity: controls.filter(c => c.category === 'processing_integrity' && c.status === 'implemented').length / controls.filter(c => c.category === 'processing_integrity').length * 100,
    confidentiality: controls.filter(c => c.category === 'confidentiality' && c.status === 'implemented').length / controls.filter(c => c.category === 'confidentiality').length * 100,
    privacy: controls.filter(c => c.category === 'privacy' && c.status === 'implemented').length / controls.filter(c => c.category === 'privacy').length * 100
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">SOC 2 control mock</h2>
          <p className="text-warning/70 text-sm mt-1">Hardcoded sample rows — not a SOC 2 Type II certification and not connected to an audit API.</p>
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
            Upload Evidence
          </Button>
        </div>
      </div>

      {/* Overall Score Card */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-warning" />
            SOC2 Compliance Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl font-bold text-foreground">{overallScore}%</div>
                <div>
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Compliant
                  </Badge>
                </div>
              </div>
              <Progress value={overallScore} className="h-3" />
              <p className="text-warning/70 text-sm mt-2">
                {controls.filter(c => c.status === 'implemented').length} of {controls.length} controls implemented
              </p>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(categoryScores).map(([category, score]) => (
                <div key={category} className="text-center">
                  <div className="text-2xl font-bold text-foreground">{Math.round(score)}%</div>
                  <div className={`text-xs capitalize ${getCategoryColor(category)}`}>
                    {category.replace('_', ' ')}
                  </div>
                </div>
              ))}
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
          <TabsTrigger value="controls" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <FileText className="h-4 w-4 mr-2" />
            Controls
          </TabsTrigger>
          <TabsTrigger value="evidence" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <FileText className="h-4 w-4 mr-2" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="incidents" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Incidents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Activity className="h-5 w-5 text-warning" />
                  Control Status Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-warning/70">Implemented</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-secondary-background rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(controls.filter(c => c.status === 'implemented').length / controls.length) * 100}%` }} />
                      </div>
                      <span className="text-foreground">{controls.filter(c => c.status === 'implemented').length}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-warning/70">Partial</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-secondary-background rounded-full h-2">
                        <div className="bg-warning h-2 rounded-full" style={{ width: `${(controls.filter(c => c.status === 'partial').length / controls.length) * 100}%` }} />
                      </div>
                      <span className="text-foreground">{controls.filter(c => c.status === 'partial').length}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-warning/70">Not Implemented</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-secondary-background rounded-full h-2">
                        <div className="bg-destructive/100 h-2 rounded-full" style={{ width: `${(controls.filter(c => c.status === 'not-implemented').length / controls.length) * 100}%` }} />
                      </div>
                      <span className="text-foreground">{controls.filter(c => c.status === 'not-implemented').length}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-warning" />
                  Upcoming Assessments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {controls
                    // eslint-disable-next-line react-hooks/purity
                    .filter(c => c.nextAssessed <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                    .slice(0, 3)
                    .map(control => (
                      <div key={control.id} className="flex items-center justify-between p-2 bg-secondary-background/60 rounded">
                        <div>
                          <span className="text-foreground text-sm">{control.name}</span>
                          <div className="text-warning/70 text-xs">{control.nextAssessed.toLocaleDateString()}</div>
                        </div>
                        {getStatusBadge(control.status)}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="controls">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">SOC2 Controls</CardTitle>
              <CardDescription className="text-warning/70">
                Manage and monitor SOC2 compliance controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search controls..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Categories</option>
                  <option value="security">Security</option>
                  <option value="availability">Availability</option>
                  <option value="processing_integrity">Processing Integrity</option>
                  <option value="confidentiality">Confidentiality</option>
                  <option value="privacy">Privacy</option>
                </select>
              </div>

              {/* Controls List */}
              <div className="space-y-4">
                {filteredControls.map((control) => (
                  <div key={control.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{control.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{control.id}</span>
                          <Badge variant="outline" className={`ml-2 border-warning/30 ${getCategoryColor(control.category)}`}>
                            {control.category.replace('_', ' ')}
                          </Badge>
                        </div>
                        {getStatusBadge(control.status)}
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{control.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {control.responsible}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Next: {control.nextAssessed.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {control.evidenceCount} evidence items
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

        <TabsContent value="evidence">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Evidence Repository</CardTitle>
              <CardDescription className="text-warning/70">
                Manage evidence for SOC2 compliance controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {evidence.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{item.description}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {item.controlId}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-warning/70 border-warning/30">
                          {item.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.uploadedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {item.uploadDate.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Security Incidents</CardTitle>
              <CardDescription className="text-warning/70">
                Track and manage security incidents affecting SOC2 compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div key={incident.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{incident.type}</span>
                          <span className="text-warning/70 text-sm ml-2">{incident.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(incident.severity)}
                          {getStatusBadge(incident.status)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{incident.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {incident.reportedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {incident.reportedDate.toLocaleDateString()}
                        </span>
                        {incident.resolvedDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Resolved: {incident.resolvedDate.toLocaleDateString()}
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
      </Tabs>
    </div>
  );
};

export default SOC2ComplianceDashboard;
