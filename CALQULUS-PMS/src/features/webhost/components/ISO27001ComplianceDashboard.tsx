// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Progress } from '@/shared/components/ui/progress';
import { Input } from '@/shared/components/ui/input';
import {
  ShieldCheck, FileText, AlertTriangle, CheckCircle, Clock,
  Download, Upload, Search, Filter, TrendingUp, Calendar,
  User, Activity, Target, AlertCircle, Risk, Shield
} from 'lucide-react';

interface ISO27001Control {
  id: string;
  name: string;
  clause: string;
  category: 'access_control' | 'asset_management' | 'cryptography' | 'physical_security' | 'operations_security' | 'communications_security' | 'system_acquisition' | 'supplier_relationships' | 'incident_management' | 'business_continuity';
  description: string;
  status: 'implemented' | 'partial' | 'not-implemented';
  lastAssessed: Date;
  nextAssessment: Date;
  evidenceCount: number;
  responsible: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ISO27001Risk {
  id: string;
  name: string;
  category: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  treatment: 'accept' | 'mitigate' | 'transfer' | 'avoid';
  status: 'open' | 'mitigating' | 'mitigated';
  owner: string;
  lastReviewed: Date;
}

interface ISO27001Asset {
  id: string;
  name: string;
  type: 'hardware' | 'software' | 'data' | 'personnel' | 'facility';
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  owner: string;
  location: string;
  value: string;
}

const ISO27001ComplianceDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock data - in production, this would come from the ISO27001 compliance API
  const controls: ISO27001Control[] = [
    {
      id: 'A.5.1',
      name: 'Policies for Information Security',
      clause: 'A.5',
      category: 'access_control',
      description: 'Information security policy approved by management',
      status: 'implemented',
      lastAssessed: new Date('2026-05-15'),
      nextAssessed: new Date('2026-08-15'),
      evidenceCount: 5,
      responsible: 'CISO',
      riskLevel: 'low'
    },
    {
      id: 'A.8.1',
      name: 'Asset Responsibility',
      clause: 'A.8',
      category: 'asset_management',
      description: 'Inventory of assets and owners identified',
      status: 'implemented',
      lastAssessed: new Date('2026-05-20'),
      nextAssessed: new Date('2026-08-20'),
      evidenceCount: 8,
      responsible: 'Asset Manager',
      riskLevel: 'medium'
    },
    {
      id: 'A.10.1',
      name: 'Cryptography Controls',
      clause: 'A.10',
      category: 'cryptography',
      description: 'Policy on use of cryptographic controls',
      status: 'implemented',
      lastAssessed: new Date('2026-05-25'),
      nextAssessed: new Date('2026-08-25'),
      evidenceCount: 6,
      responsible: 'Security Engineer',
      riskLevel: 'high'
    },
    {
      id: 'A.11.1',
      name: 'Physical Security Perimeters',
      clause: 'A.11',
      category: 'physical_security',
      description: 'Physical entry controls and security areas',
      status: 'partial',
      lastAssessed: new Date('2026-05-10'),
      nextAssessed: new Date('2026-08-10'),
      evidenceCount: 4,
      responsible: 'Facilities Manager',
      riskLevel: 'medium'
    },
    {
      id: 'A.12.1',
      name: 'Operational Procedures',
      clause: 'A.12',
      category: 'operations_security',
      description: 'Documented operating procedures',
      status: 'implemented',
      lastAssessed: new Date('2026-05-22'),
      nextAssessed: new Date('2026-08-22'),
      evidenceCount: 10,
      responsible: 'IT Operations',
      riskLevel: 'low'
    },
    {
      id: 'A.13.1',
      name: 'Network Security',
      clause: 'A.13',
      category: 'communications_security',
      description: 'Network controls and network services',
      status: 'partial',
      lastAssessed: new Date('2026-05-18'),
      nextAssessed: new Date('2026-08-18'),
      evidenceCount: 5,
      responsible: 'Network Engineer',
      riskLevel: 'high'
    },
    {
      id: 'A.14.1',
      name: 'Security Requirements',
      clause: 'A.14',
      category: 'system_acquisition',
      description: 'Security requirements for information systems',
      status: 'not-implemented',
      lastAssessed: new Date('2026-04-15'),
      nextAssessed: new Date('2026-07-15'),
      evidenceCount: 0,
      responsible: 'Development Lead',
      riskLevel: 'high'
    },
    {
      id: 'A.15.1',
      name: 'Supplier Relationships',
      clause: 'A.15',
      category: 'supplier_relationships',
      description: 'Information security in supplier relationships',
      status: 'implemented',
      lastAssessed: new Date('2026-05-28'),
      nextAssessed: new Date('2026-08-28'),
      evidenceCount: 7,
      responsible: 'Procurement',
      riskLevel: 'medium'
    },
    {
      id: 'A.16.1',
      name: 'Incident Management',
      clause: 'A.16',
      category: 'incident_management',
      description: 'Management of information security incidents',
      status: 'implemented',
      lastAssessed: new Date('2026-05-30'),
      nextAssessed: new Date('2026-08-30'),
      evidenceCount: 9,
      responsible: 'CISO',
      riskLevel: 'high'
    },
    {
      id: 'A.17.1',
      name: 'Information Security Continuity',
      clause: 'A.17',
      category: 'business_continuity',
      description: 'Information security continuity',
      status: 'partial',
      lastAssessed: new Date('2026-05-12'),
      nextAssessed: new Date('2026-08-12'),
      evidenceCount: 3,
      responsible: 'Business Continuity Manager',
      riskLevel: 'high'
    }
  ];

  const risks: ISO27001Risk[] = [
    {
      id: 'RISK-001',
      name: 'Data Breach',
      category: 'Security',
      likelihood: 3,
      impact: 5,
      riskScore: 15,
      treatment: 'mitigate',
      status: 'mitigating',
      owner: 'CISO',
      lastReviewed: new Date('2026-05-28')
    },
    {
      id: 'RISK-002',
      name: 'Service Outage',
      category: 'Availability',
      likelihood: 4,
      impact: 4,
      riskScore: 16,
      treatment: 'mitigate',
      status: 'mitigating',
      owner: 'DevOps Lead',
      lastReviewed: new Date('2026-05-25')
    },
    {
      id: 'RISK-003',
      name: 'Compliance Violation',
      category: 'Compliance',
      likelihood: 2,
      impact: 5,
      riskScore: 10,
      treatment: 'mitigate',
      status: 'mitigated',
      owner: 'Legal Counsel',
      lastReviewed: new Date('2026-05-20')
    }
  ];

  const assets: ISO27001Asset[] = [
    {
      id: 'AST-001',
      name: 'Production Database',
      type: 'hardware',
      classification: 'restricted',
      owner: 'DBA Team',
      location: 'Primary Data Center',
      value: 'Critical'
    },
    {
      id: 'AST-002',
      name: 'Customer Data',
      type: 'data',
      classification: 'confidential',
      owner: 'Data Steward',
      location: 'Cloud Storage',
      value: 'High'
    },
    {
      id: 'AST-003',
      name: 'Application Code',
      type: 'software',
      classification: 'internal',
      owner: 'Development Team',
      location: 'Git Repository',
      value: 'High'
    },
    {
      id: 'AST-004',
      name: 'Office Building',
      type: 'facility',
      classification: 'public',
      owner: 'Facilities',
      location: 'Nairobi HQ',
      value: 'Medium'
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
      case 'mitigated':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'partial':
      case 'mitigating':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'not-implemented':
      case 'open':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge className="bg-destructive text-white border-red-700">{level}</Badge>;
      case 'medium':
        return <Badge className="bg-warning text-white border-warning">{level}</Badge>;
      case 'low':
        return <Badge className="bg-blue-500 text-white border-blue-600">{level}</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'restricted':
        return <Badge className="bg-destructive/15 text-destructive border-red-300">{classification}</Badge>;
      case 'confidential':
        return <Badge className="bg-warning/10 text-warning border-orange-300">{classification}</Badge>;
      case 'internal':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{classification}</Badge>;
      case 'public':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{classification}</Badge>;
      default:
        return <Badge variant="outline">{classification}</Badge>;
    }
  };

  const overallScore = Math.round(
    (controls.filter(c => c.status === 'implemented').length / controls.length) * 100
  );

  const categoryScores = {
    access_control: controls.filter(c => c.category === 'access_control' && c.status === 'implemented').length / controls.filter(c => c.category === 'access_control').length * 100,
    asset_management: controls.filter(c => c.category === 'asset_management' && c.status === 'implemented').length / controls.filter(c => c.category === 'asset_management').length * 100,
    cryptography: controls.filter(c => c.category === 'cryptography' && c.status === 'implemented').length / controls.filter(c => c.category === 'cryptography').length * 100,
    physical_security: controls.filter(c => c.category === 'physical_security' && c.status === 'implemented').length / controls.filter(c => c.category === 'physical_security').length * 100,
    operations_security: controls.filter(c => c.category === 'operations_security' && c.status === 'implemented').length / controls.filter(c => c.category === 'operations_security').length * 100,
    communications_security: controls.filter(c => c.category === 'communications_security' && c.status === 'implemented').length / controls.filter(c => c.category === 'communications_security').length * 100,
    system_acquisition: controls.filter(c => c.category === 'system_acquisition' && c.status === 'implemented').length / controls.filter(c => c.category === 'system_acquisition').length * 100,
    supplier_relationships: controls.filter(c => c.category === 'supplier_relationships' && c.status === 'implemented').length / controls.filter(c => c.category === 'supplier_relationships').length * 100,
    incident_management: controls.filter(c => c.category === 'incident_management' && c.status === 'implemented').length / controls.filter(c => c.category === 'incident_management').length * 100,
    business_continuity: controls.filter(c => c.category === 'business_continuity' && c.status === 'implemented').length / controls.filter(c => c.category === 'business_continuity').length * 100
  };

  const totalRiskScore = risks.reduce((sum, risk) => sum + risk.riskScore, 0);
  const averageRiskScore = Math.round(totalRiskScore / risks.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">ISO 27001 control mock</h2>
          <p className="text-warning/70 text-sm mt-1">Hardcoded sample rows — not an ISO 27001 certification and not connected to an ISMS API.</p>
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
            ISO 27001 Compliance Score
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
              {Object.entries(categoryScores).slice(0, 5).map(([category, score]) => (
                <div key={category} className="text-center">
                  <div className="text-2xl font-bold text-foreground">{Math.round(score)}%</div>
                  <div className="text-xs text-warning/70 capitalize">
                    {category.replace('_', ' ').substring(0, 10)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Summary Card */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Risk className="h-5 w-5 text-warning" />
            Risk Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-warning" />
                <span className="text-foreground font-medium">Total Risks</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{risks.length}</div>
              <div className="text-sm text-warning/70">Active risks identified</div>
            </div>
            <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="text-foreground font-medium">Average Risk Score</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{averageRiskScore}</div>
              <div className="text-sm text-warning/70">Out of 25 maximum</div>
            </div>
            <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-warning" />
                <span className="text-foreground font-medium">Mitigated Risks</span>
              </div>
              <div className="text-3xl font-bold text-foreground">{risks.filter(r => r.status === 'mitigated').length}</div>
              <div className="text-sm text-warning/70">Successfully mitigated</div>
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
          <TabsTrigger value="risks" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Risk className="h-4 w-4 mr-2" />
            Risks
          </TabsTrigger>
          <TabsTrigger value="assets" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Target className="h-4 w-4 mr-2" />
            Assets
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
                  High-Risk Controls
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {controls
                    .filter(c => c.riskLevel === 'high' && c.status !== 'implemented')
                    .slice(0, 4)
                    .map(control => (
                      <div key={control.id} className="flex items-center justify-between p-2 bg-secondary-background/60 rounded">
                        <div>
                          <span className="text-foreground text-sm">{control.name}</span>
                          <div className="text-warning/70 text-xs">{control.clause}</div>
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
              <CardTitle className="text-foreground">ISO 27001 Controls</CardTitle>
              <CardDescription className="text-warning/70">
                Manage and monitor ISO 27001 Annex A controls
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
                  <option value="access_control">Access Control</option>
                  <option value="asset_management">Asset Management</option>
                  <option value="cryptography">Cryptography</option>
                  <option value="physical_security">Physical Security</option>
                  <option value="operations_security">Operations Security</option>
                  <option value="communications_security">Communications Security</option>
                  <option value="system_acquisition">System Acquisition</option>
                  <option value="supplier_relationships">Supplier Relationships</option>
                  <option value="incident_management">Incident Management</option>
                  <option value="business_continuity">Business Continuity</option>
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
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {control.clause}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRiskBadge(control.riskLevel)}
                          {getStatusBadge(control.status)}
                        </div>
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

        <TabsContent value="risks">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Risk Register</CardTitle>
              <CardDescription className="text-warning/70">
                Manage and monitor information security risks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {risks.map((risk) => (
                  <div key={risk.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{risk.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{risk.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {risk.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-warning/15 text-warning border-warning/25">
                            Score: {risk.riskScore}
                          </Badge>
                          {getStatusBadge(risk.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span>Likelihood: {risk.likelihood}/5</span>
                        <span>Impact: {risk.impact}/5</span>
                        <span>Treatment: {risk.treatment}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {risk.owner}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Last reviewed: {risk.lastReviewed.toLocaleDateString()}
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

        <TabsContent value="assets">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Asset Inventory</CardTitle>
              <CardDescription className="text-warning/70">
                Manage information security assets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assets.map((asset) => (
                  <div key={asset.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{asset.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{asset.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {asset.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getClassificationBadge(asset.classification)}
                          <Badge variant="outline" className="text-warning/70 border-warning/30">
                            {asset.value}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {asset.owner}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {asset.location}
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
      </Tabs>
    </div>
  );
};

export default ISO27001ComplianceDashboard;
