// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Progress } from '@/shared/components/ui/progress';
import {
  ShieldCheck, FileText, Database, Lock, Scale, Bug,
  AlertTriangle, CheckCircle, Clock, TrendingUp, Download,
  RefreshCw, AlertCircle, Info
} from 'lucide-react';

interface ComplianceScore {
  framework: string;
  score: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  lastAssessed: Date;
  controlsImplemented: number;
  totalControls: number;
}

interface Control {
  id: string;
  name: string;
  category: string;
  status: 'implemented' | 'partial' | 'not-implemented';
  lastAssessed: Date;
  nextAssessment: Date;
  evidenceCount: number;
}

interface Incident {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  reportedDate: Date;
  resolvedDate?: Date;
}

const ComplianceDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Mock data - in production, this would come from the compliance API
  const complianceScores: ComplianceScore[] = [
    {
      framework: 'SOC2 Type II',
      score: 92,
      status: 'compliant',
      lastAssessed: new Date('2026-05-15'),
      controlsImplemented: 58,
      totalControls: 63
    },
    {
      framework: 'ISO 27001',
      score: 88,
      status: 'compliant',
      lastAssessed: new Date('2026-05-20'),
      controlsImplemented: 102,
      totalControls: 114
    },
    {
      framework: 'Data Retention',
      score: 95,
      status: 'compliant',
      lastAssessed: new Date('2026-05-25'),
      controlsImplemented: 28,
      totalControls: 30
    },
    {
      framework: 'Privacy (GDPR)',
      score: 90,
      status: 'compliant',
      lastAssessed: new Date('2026-05-22'),
      controlsImplemented: 45,
      totalControls: 50
    },
    {
      framework: 'Legal Audit',
      score: 85,
      status: 'partial',
      lastAssessed: new Date('2026-05-18'),
      controlsImplemented: 34,
      totalControls: 40
    },
    {
      framework: 'Penetration Testing',
      score: 78,
      status: 'partial',
      lastAssessed: new Date('2026-05-10'),
      controlsImplemented: 14,
      totalControls: 18
    }
  ];

  const recentIncidents: Incident[] = [
    {
      id: 'INC-001',
      type: 'Unauthorized Access Attempt',
      severity: 'medium',
      status: 'resolved',
      reportedDate: new Date('2026-05-28'),
      resolvedDate: new Date('2026-05-29')
    },
    {
      id: 'INC-002',
      type: 'Data Exfiltration Alert',
      severity: 'high',
      status: 'investigating',
      reportedDate: new Date('2026-06-01')
    },
    {
      id: 'INC-003',
      type: 'System Outage',
      severity: 'low',
      status: 'resolved',
      reportedDate: new Date('2026-05-25'),
      resolvedDate: new Date('2026-05-25')
    }
  ];

  const controlsNeedingAttention: Control[] = [
    {
      id: 'CTRL-001',
      name: 'Multi-factor Authentication Enforcement',
      category: 'Access Control',
      status: 'partial',
      lastAssessed: new Date('2026-05-15'),
      nextAssessed: new Date('2026-08-15'),
      evidenceCount: 2
    },
    {
      id: 'CTRL-002',
      name: 'Data Encryption at Rest',
      category: 'Data Security',
      status: 'implemented',
      lastAssessed: new Date('2026-05-20'),
      nextAssessed: new Date('2026-08-20'),
      evidenceCount: 5
    },
    {
      id: 'CTRL-003',
      name: 'Incident Response Plan',
      category: 'Security Operations',
      status: 'not-implemented',
      lastAssessed: new Date('2026-05-10'),
      nextAssessed: new Date('2026-08-10'),
      evidenceCount: 0
    }
  ];

  const handleRefresh = () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false);
    }, 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'implemented':
      case 'resolved':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'partial':
      case 'investigating':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'non-compliant':
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

  const overallScore = Math.round(
    complianceScores.reduce((sum, score) => sum + score.score, 0) / complianceScores.length
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Compliance mock</h2>
          <p className="text-warning/70 text-sm mt-1">Sample scores only — not evidence of SOC 2, ISO, or PCI certification.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-warning/30 text-warning/80 hover:bg-warning/8"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overall Score Card */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-warning" />
            Overall Compliance Score
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
                Last updated: June 3, 2026
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{complianceScores.length}</div>
                <div className="text-warning/70 text-sm">Frameworks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {complianceScores.filter(s => s.status === 'compliant').length}
                </div>
                <div className="text-warning/70 text-sm">Compliant</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {complianceScores.filter(s => s.status === 'partial').length}
                </div>
                <div className="text-warning/70 text-sm">Partial</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {complianceScores.filter(s => s.status === 'non-compliant').length}
                </div>
                <div className="text-warning/70 text-sm">Non-Compliant</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framework Scores */}
      <Card className="bg-card border-warning/15">
        <CardHeader>
          <CardTitle className="text-foreground">Framework Compliance Scores</CardTitle>
          <CardDescription className="text-warning/70">
            Compliance status across all frameworks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {complianceScores.map((score) => (
              <div key={score.framework} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground font-medium">{score.framework}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-warning/70 text-sm">
                        {score.controlsImplemented}/{score.totalControls} controls
                      </span>
                      {getStatusBadge(score.status)}
                    </div>
                  </div>
                  <Progress value={score.score} className="h-2" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-warning/70 text-sm">
                      Last assessed: {score.lastAssessed.toLocaleDateString()}
                    </span>
                    <span className="text-foreground font-semibold">{score.score}%</span>
                  </div>
                </div>
              </div>
            ))}
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
          <TabsTrigger value="incidents" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Incidents
          </TabsTrigger>
          <TabsTrigger value="data-retention" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Database className="h-4 w-4 mr-2" />
            Data Retention
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Lock className="h-4 w-4 mr-2" />
            Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="controls">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Controls Overview</CardTitle>
              <CardDescription className="text-warning/70">
                Manage and monitor compliance controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {controlsNeedingAttention.map((control) => (
                  <div key={control.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{control.name}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {control.category}
                          </Badge>
                        </div>
                        {getStatusBadge(control.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span>Next assessment: {control.nextAssessment.toLocaleDateString()}</span>
                        <span>Evidence: {control.evidenceCount} items</span>
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

        <TabsContent value="incidents">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Security Incidents</CardTitle>
              <CardDescription className="text-warning/70">
                Track and manage security incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentIncidents.map((incident) => (
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
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span>Reported: {incident.reportedDate.toLocaleDateString()}</span>
                        {incident.resolvedDate && (
                          <span>Resolved: {incident.resolvedDate.toLocaleDateString()}</span>
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

        <TabsContent value="data-retention">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Database className="h-5 w-5 text-warning" />
                Data Retention Policies
              </CardTitle>
              <CardDescription className="text-warning/70">
                Manage data retention and disposal policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground font-medium">Personal Data</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>
                  </div>
                  <div className="text-sm text-warning/70">
                    Retention: 7 years after tenant departure
                  </div>
                  <div className="text-sm text-warning/70">
                    Disposal: Secure deletion
                  </div>
                </div>
                <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground font-medium">Financial Data</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>
                  </div>
                  <div className="text-sm text-warning/70">
                    Retention: 10 years after transaction
                  </div>
                  <div className="text-sm text-warning/70">
                    Disposal: Secure archival
                  </div>
                </div>
                <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-foreground font-medium">Operational Logs</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>
                  </div>
                  <div className="text-sm text-warning/70">
                    Retention: 2 years
                  </div>
                  <div className="text-sm text-warning/70">
                    Disposal: Secure deletion
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Lock className="h-5 w-5 text-warning" />
                Privacy Compliance
              </CardTitle>
              <CardDescription className="text-warning/70">
                Monitor privacy compliance and data subject requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="h-4 w-4 text-warning" />
                    <span className="text-foreground font-medium">Data Subject Requests</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">12</div>
                  <div className="text-sm text-warning/70">Pending: 3 | Completed: 9</div>
                </div>
                <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-warning" />
                    <span className="text-foreground font-medium">Consent Records</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">1,245</div>
                  <div className="text-sm text-warning/70">Active consents</div>
                </div>
                <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    <span className="text-foreground font-medium">Data Breaches</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">0</div>
                  <div className="text-sm text-warning/70">No breaches in last 12 months</div>
                </div>
                <div className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-warning" />
                    <span className="text-foreground font-medium">Privacy Impact Assessments</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground mb-1">8</div>
                  <div className="text-sm text-warning/70">Completed assessments</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComplianceDashboard;
