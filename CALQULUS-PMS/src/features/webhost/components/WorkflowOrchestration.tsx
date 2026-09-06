// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  Workflow, Search, Filter, Download, RefreshCw, Play, Pause,
  CheckCircle, AlertTriangle, Clock, Activity, TrendingUp, Award,
  FileText, Building2, Target, Zap, ArrowRight, Settings, Layers,
  GitBranch, Circle, MoreHorizontal, ChevronRight
} from 'lucide-react';

interface WorkflowTemplate {
  id: string;
  name: string;
  category: 'onboarding' | 'maintenance' | 'billing' | 'compliance' | 'custom';
  description: string;
  steps: number;
  averageDuration: string;
  usageCount: number;
  status: 'active' | 'draft' | 'archived';
  lastUsed: Date;
}

interface WorkflowInstance {
  id: string;
  templateId: string;
  templateName: string;
  entityId: string;
  entityName: string;
  entityType: 'property' | 'tenant' | 'lease' | 'maintenance' | 'invoice';
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  totalSteps: number;
  progress: number;
  startedDate: Date;
  completedDate?: Date;
  estimatedCompletion?: Date;
  assignee: string;
}

interface WorkflowStep {
  id: string;
  workflowInstanceId: string;
  stepNumber: number;
  name: string;
  description: string;
  type: 'manual' | 'automated' | 'conditional' | 'approval';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  assignee?: string;
  startedDate?: Date;
  completedDate?: Date;
  duration?: string;
}

interface WorkflowAutomation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  target: string;
  frequency: string;
  status: 'active' | 'paused' | 'disabled';
  lastRun: Date;
  nextRun: Date;
  successRate: number;
}

const WorkflowOrchestration = () => {
  const [activeTab, setActiveTab] = useState('templates');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Mock data - in production, this would come from the workflow orchestration API
  const workflowTemplates: WorkflowTemplate[] = [
    {
      id: 'WFT-001',
      name: 'Tenant Onboarding',
      category: 'onboarding',
      description: 'Complete tenant onboarding process including verification, lease signing, and setup',
      steps: 8,
      averageDuration: '2-3 days',
      usageCount: 234,
      status: 'active',
      lastUsed: new Date('2026-06-02')
    },
    {
      id: 'WFT-002',
      name: 'Maintenance Request Processing',
      category: 'maintenance',
      description: 'Process maintenance requests from submission to completion',
      steps: 5,
      averageDuration: '1-2 days',
      usageCount: 567,
      status: 'active',
      lastUsed: new Date('2026-06-03')
    },
    {
      id: 'WFT-003',
      name: 'Invoice Generation and Payment',
      category: 'billing',
      description: 'Generate invoices and process payments automatically',
      steps: 4,
      averageDuration: '1 day',
      usageCount: 890,
      status: 'active',
      lastUsed: new Date('2026-06-01')
    },
    {
      id: 'WFT-004',
      name: 'Compliance Audit',
      category: 'compliance',
      description: 'Run compliance checks and generate audit reports',
      steps: 6,
      averageDuration: '3-5 days',
      usageCount: 45,
      status: 'active',
      lastUsed: new Date('2026-05-28')
    },
    {
      id: 'WFT-005',
      name: 'Property Setup',
      category: 'onboarding',
      description: 'Set up new property with all required configurations',
      steps: 10,
      averageDuration: '5-7 days',
      usageCount: 23,
      status: 'draft',
      lastUsed: new Date('2026-05-15')
    }
  ];

  const workflowInstances: WorkflowInstance[] = [
    {
      id: 'WFI-001',
      templateId: 'WFT-001',
      templateName: 'Tenant Onboarding',
      entityId: 'TEN-001',
      entityName: 'John Kamau',
      entityType: 'tenant',
      status: 'running',
      currentStep: 5,
      totalSteps: 8,
      progress: 62,
      startedDate: new Date('2026-06-01'),
      estimatedCompletion: new Date('2026-06-03'),
      assignee: 'Property Manager'
    },
    {
      id: 'WFI-002',
      templateId: 'WFT-002',
      templateName: 'Maintenance Request Processing',
      entityId: 'WO-001',
      entityName: 'Leaking Faucet Repair',
      entityType: 'maintenance',
      status: 'completed',
      currentStep: 5,
      totalSteps: 5,
      progress: 100,
      startedDate: new Date('2026-05-28'),
      completedDate: new Date('2026-05-30'),
      assignee: 'Maintenance Supervisor'
    },
    {
      id: 'WFI-003',
      templateId: 'WFT-003',
      templateName: 'Invoice Generation and Payment',
      entityId: 'PROP-001',
      entityName: 'Sunset Apartments',
      entityType: 'property',
      status: 'failed',
      currentStep: 3,
      totalSteps: 4,
      progress: 75,
      startedDate: new Date('2026-06-02'),
      assignee: 'Finance Team'
    }
  ];

  const workflowSteps: WorkflowStep[] = [
    {
      id: 'WFS-001',
      workflowInstanceId: 'WFI-001',
      stepNumber: 1,
      name: 'Identity Verification',
      description: 'Verify tenant identity documents',
      type: 'automated',
      status: 'completed',
      startedDate: new Date('2026-06-01T09:00:00'),
      completedDate: new Date('2026-06-01T10:30:00'),
      duration: '1.5 hours'
    },
    {
      id: 'WFS-002',
      workflowInstanceId: 'WFI-001',
      stepNumber: 2,
      name: 'Credit Check',
      description: 'Run credit background check',
      type: 'automated',
      status: 'completed',
      startedDate: new Date('2026-06-01T10:30:00'),
      completedDate: new Date('2026-06-01T11:00:00'),
      duration: '30 minutes'
    },
    {
      id: 'WFS-003',
      workflowInstanceId: 'WFI-001',
      stepNumber: 3,
      name: 'Lease Agreement Review',
      description: 'Review and approve lease terms',
      type: 'approval',
      status: 'completed',
      assignee: 'Property Manager',
      startedDate: new Date('2026-06-01T11:00:00'),
      completedDate: new Date('2026-06-02T09:00:00'),
      duration: '22 hours'
    },
    {
      id: 'WFS-004',
      workflowInstanceId: 'WFI-001',
      stepNumber: 4,
      name: 'Lease Signing',
      description: 'Sign lease agreement',
      type: 'manual',
      status: 'completed',
      assignee: 'John Kamau',
      startedDate: new Date('2026-06-02T09:00:00'),
      completedDate: new Date('2026-06-02T14:00:00'),
      duration: '5 hours'
    },
    {
      id: 'WFS-005',
      workflowInstanceId: 'WFI-001',
      stepNumber: 5,
      name: 'Payment Setup',
      description: 'Set up payment methods',
      type: 'manual',
      status: 'in_progress',
      assignee: 'John Kamau',
      startedDate: new Date('2026-06-02T14:00:00')
    }
  ];

  const workflowAutomations: WorkflowAutomation[] = [
    {
      id: 'WFA-001',
      name: 'Monthly Invoice Generation',
      trigger: 'Monthly schedule (1st of month)',
      action: 'Generate invoices for all active leases',
      target: 'All properties',
      frequency: 'Monthly',
      status: 'active',
      lastRun: new Date('2026-06-01'),
      nextRun: new Date('2026-07-01'),
      successRate: 98
    },
    {
      id: 'WFA-002',
      name: 'Lease Expiration Reminder',
      trigger: '30 days before lease end',
      action: 'Send renewal reminder to tenant',
      target: 'Expiring leases',
      frequency: 'Daily check',
      status: 'active',
      lastRun: new Date('2026-06-03'),
      nextRun: new Date('2026-06-04'),
      successRate: 95
    },
    {
      id: 'WFA-003',
      name: 'Maintenance Escalation',
      trigger: '48 hours without response',
      action: 'Escalate to supervisor',
      target: 'Pending maintenance requests',
      frequency: 'Daily check',
      status: 'active',
      lastRun: new Date('2026-06-03'),
      nextRun: new Date('2026-06-04'),
      successRate: 100
    }
  ];

  const filteredTemplates = workflowTemplates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'running':
      case 'in_progress':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Activity className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'paused':
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'failed':
      case 'cancelled':
      case 'disabled':
      case 'archived':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'skipped':
        return <Badge className="bg-secondary-background text-gray-800 border-gray-300"><MoreHorizontal className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'draft':
        return <Badge className="bg-warning/15 text-warning border-warning/25"><FileText className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'onboarding':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><Layers className="h-3 w-3 mr-1" />{category}</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="text-warning border-orange-700"><Settings className="h-3 w-3 mr-1" />{category}</Badge>;
      case 'billing':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Target className="h-3 w-3 mr-1" />{category}</Badge>;
      case 'compliance':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><Award className="h-3 w-3 mr-1" />{category}</Badge>;
      case 'custom':
        return <Badge variant="outline" className="text-yellow-300 border-yellow-700"><GitBranch className="h-3 w-3 mr-1" />{category}</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'manual':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><User className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'automated':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Zap className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'conditional':
        return <Badge variant="outline" className="text-yellow-300 border-yellow-700"><GitBranch className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'approval':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><CheckCircle className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalTemplates = workflowTemplates.length;
  const runningWorkflows = workflowInstances.filter(w => w.status === 'running').length;
  const activeAutomations = workflowAutomations.filter(a => a.status === 'active').length;
  const completedToday = workflowInstances.filter(w => w.status === 'completed' && w.completedDate && w.completedDate.toDateString() === new Date().toDateString()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Workflow Orchestration</h2>
          <p className="text-warning/70 text-sm mt-1">Automate and manage business processes</p>
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
              <Workflow className="h-4 w-4 text-warning" />
              Total Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalTemplates}</div>
            <div className="text-sm text-warning/70">Workflow templates</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-warning" />
              Running Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{runningWorkflows}</div>
            <div className="text-sm text-warning/70">In progress</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              Active Automations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeAutomations}</div>
            <div className="text-sm text-warning/70">Automated processes</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-warning" />
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{completedToday}</div>
            <div className="text-sm text-warning/70">Workflows finished</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="templates" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Layers className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="instances" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Activity className="h-4 w-4 mr-2" />
            Instances
          </TabsTrigger>
          <TabsTrigger value="steps" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <GitBranch className="h-4 w-4 mr-2" />
            Steps
          </TabsTrigger>
          <TabsTrigger value="automations" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Zap className="h-4 w-4 mr-2" />
            Automations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Workflow Templates</CardTitle>
              <CardDescription className="text-warning/70">
                Reusable workflow templates for common processes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search templates..."
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
                  <option value="onboarding">Onboarding</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="billing">Billing</option>
                  <option value="compliance">Compliance</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {/* Templates List */}
              <div className="grid gap-4 md:grid-cols-2">
                {filteredTemplates.map((template) => (
                  <div key={template.id} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-foreground font-medium">{template.name}</span>
                          {getCategoryBadge(template.category)}
                        </div>
                        {getStatusBadge(template.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-warning/70 border-warning/30">
                          {template.steps} steps
                        </Badge>
                      </div>
                    </div>
                    <p className="text-warning/70 text-sm mb-3">{template.description}</p>
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div className="flex items-center gap-2 text-warning/70">
                        <Clock className="h-3 w-3" />
                        {template.averageDuration}
                      </div>
                      <div className="flex items-center gap-2 text-warning/70">
                        <Activity className="h-3 w-3" />
                        {template.usageCount} uses
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-warning/70">
                        Last used: {template.lastUsed.toLocaleDateString()}
                      </div>
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        <Play className="h-4 w-4 mr-2" />
                        Run Workflow
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instances">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Workflow Instances</CardTitle>
              <CardDescription className="text-warning/70">
                Active and completed workflow instances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowInstances.map((instance) => (
                  <div key={instance.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{instance.templateName}</span>
                          <span className="text-warning/70 text-sm ml-2">{instance.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {instance.entityType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(instance.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {instance.entityName}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {instance.assignee}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          Step {instance.currentStep} of {instance.totalSteps}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Started: {instance.startedDate.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <Progress value={instance.progress} className="h-2 flex-1" />
                        <span className="text-warning/70">{instance.progress}%</span>
                      </div>
                    </div>
                    {instance.status === 'running' && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="border-yellow-700 text-yellow-300 hover:bg-yellow-900/50">
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                        <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                          View Details
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Workflow Steps</CardTitle>
              <CardDescription className="text-warning/70">
                Detailed view of workflow execution steps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowSteps.map((step, idx) => (
                  <div key={step.id} className="flex items-start gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        step.status === 'completed' ? 'bg-green-600' :
                        step.status === 'in_progress' ? 'bg-[hsl(214_73%_45%)]' :
                        step.status === 'failed' ? 'bg-destructive' :
                        'bg-secondary-foreground'
                      }`}>
                        {step.status === 'completed' ? (
                          <CheckCircle className="h-4 w-4 text-foreground" />
                        ) : step.status === 'in_progress' ? (
                          <Activity className="h-4 w-4 text-foreground" />
                        ) : step.status === 'failed' ? (
                          <AlertTriangle className="h-4 w-4 text-foreground" />
                        ) : (
                          <Circle className="h-4 w-4 text-foreground" />
                        )}
                      </div>
                      {idx < workflowSteps.length - 1 && (
                        <div className="w-0.5 h-8 bg-[hsl(218_58%_24%)] mt-2" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{step.name}</span>
                          <span className="text-warning/70 text-sm ml-2">Step {step.stepNumber}</span>
                          {getTypeBadge(step.type)}
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(step.status)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{step.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        {step.assignee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {step.assignee}
                          </span>
                        )}
                        {step.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {step.duration}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        {step.startedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Started: {step.startedDate.toLocaleString()}
                          </span>
                        )}
                        {step.completedDate && (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Completed: {step.completedDate.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automations">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Workflow Automations</CardTitle>
              <CardDescription className="text-warning/70">
                Automated triggers and actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowAutomations.map((automation) => (
                  <div key={automation.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{automation.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{automation.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(automation.status)}
                          <Badge variant="outline" className="text-warning/70 border-warning/30">
                            {automation.successRate}% success
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          Trigger: {automation.trigger}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Target: {automation.target}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" />
                          Action: {automation.action}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Frequency: {automation.frequency}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Last run: {automation.lastRun.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next run: {automation.nextRun.toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {automation.status === 'active' && (
                      <Button variant="outline" size="sm" className="border-yellow-700 text-yellow-300 hover:bg-yellow-900/50">
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
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

export default WorkflowOrchestration;
