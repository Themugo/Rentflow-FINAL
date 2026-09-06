import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Scale, FileText, AlertTriangle, CheckCircle, Clock,
  Download, Upload, Plus, Search, Filter, Calendar,
  User, Shield, AlertCircle, Building, FileSignature,
  Briefcase, Lock, Bell, CheckSquare
} from 'lucide-react';

interface LegalRequirement {
  id: string;
  name: string;
  category: 'data_protection' | 'financial' | 'employment' | 'contractual' | 'regulatory' | 'industry_specific';
  description: string;
  jurisdiction: string;
  effectiveDate: Date;
  reviewDate: Date;
  status: 'compliant' | 'non_compliant' | 'pending_review';
  responsible: string;
}

interface AuditTrail {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  timestamp: Date;
  details: string;
  ipAddress: string;
}

interface LegalDocument {
  id: string;
  name: string;
  type: 'policy' | 'contract' | 'agreement' | 'regulation' | 'certificate';
  category: string;
  version: string;
  effectiveDate: Date;
  expiryDate?: Date;
  status: 'active' | 'expired' | 'draft' | 'archived';
  fileUrl: string;
  uploadedBy: string;
}

interface DocumentReminder {
  id: string;
  documentId: string;
  documentName: string;
  reminderType: 'expiry' | 'review' | 'renewal';
  dueDate: Date;
  status: 'pending' | 'sent' | 'acknowledged';
  sentDate?: Date;
}

interface ThirdPartyAgreement {
  id: string;
  name: string;
  type: 'data_processing' | 'service_level' | 'vendor' | 'partner';
  category: string;
  effectiveDate: Date;
  expiryDate: Date;
  status: 'active' | 'expiring' | 'expired' | 'terminated';
  vendor: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface LegalHold {
  id: string;
  name: string;
  description: string;
  reason: string;
  status: 'active' | 'released' | 'expired';
  createdDate: Date;
  expiryDate?: Date;
  affectedDocuments: number;
}

const LegalAuditDocumentation = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Mock data - in production, this would come from the legal audit API
  const legalRequirements: LegalRequirement[] = [
    {
      id: 'LR-001',
      name: 'GDPR Compliance',
      category: 'data_protection',
      description: 'General Data Protection Regulation compliance requirements',
      jurisdiction: 'EU',
      effectiveDate: new Date('2018-05-25'),
      reviewDate: new Date('2026-12-31'),
      status: 'compliant',
      responsible: 'Data Protection Officer'
    },
    {
      id: 'LR-002',
      name: 'Tax Compliance',
      category: 'financial',
      description: 'Local tax regulations and reporting requirements',
      jurisdiction: 'Kenya',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-12-31'),
      status: 'compliant',
      responsible: 'Finance Director'
    },
    {
      id: 'LR-003',
      name: 'Employment Law',
      category: 'employment',
      description: 'Employment regulations and labor laws',
      jurisdiction: 'Kenya',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-06-30'),
      status: 'pending_review',
      responsible: 'HR Director'
    },
    {
      id: 'LR-004',
      name: 'Contract Law',
      category: 'contractual',
      description: 'Contract formation and enforcement requirements',
      jurisdiction: 'Kenya',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-12-31'),
      status: 'compliant',
      responsible: 'Legal Counsel'
    },
    {
      id: 'LR-005',
      name: 'Data Protection Act',
      category: 'data_protection',
      description: 'Kenya Data Protection Act 2019 compliance',
      jurisdiction: 'Kenya',
      effectiveDate: new Date('2019-11-25'),
      reviewDate: new Date('2026-12-31'),
      status: 'compliant',
      responsible: 'Data Protection Officer'
    }
  ];

  const auditTrails: AuditTrail[] = [
    {
      id: 'AT-001',
      entityType: 'LegalDocument',
      entityId: 'DOC-001',
      action: 'Document Uploaded',
      performedBy: 'Legal Counsel',
      timestamp: new Date('2026-06-01T10:30:00'),
      details: 'Uploaded GDPR compliance policy v2.0',
      ipAddress: '192.168.1.100'
    },
    {
      id: 'AT-002',
      entityType: 'LegalRequirement',
      entityId: 'LR-003',
      action: 'Status Updated',
      performedBy: 'HR Director',
      timestamp: new Date('2026-05-28T14:45:00'),
      details: 'Employment law compliance marked for review',
      ipAddress: '192.168.1.101'
    },
    {
      id: 'AT-003',
      entityType: 'ThirdPartyAgreement',
      entityId: 'TPA-001',
      action: 'Agreement Renewed',
      performedBy: 'Procurement Manager',
      timestamp: new Date('2026-05-25T09:15:00'),
      details: 'Renewed data processing agreement with Cloud Provider',
      ipAddress: '192.168.1.102'
    }
  ];

  const legalDocuments: LegalDocument[] = [
    {
      id: 'DOC-001',
      name: 'GDPR Compliance Policy',
      type: 'policy',
      category: 'Data Protection',
      version: '2.0',
      effectiveDate: new Date('2026-01-01'),
      status: 'active',
      fileUrl: '/documents/gdpr-policy-v2.pdf',
      uploadedBy: 'Legal Counsel'
    },
    {
      id: 'DOC-002',
      name: 'Data Processing Agreement',
      type: 'agreement',
      category: 'Third Party',
      version: '1.5',
      effectiveDate: new Date('2026-02-01'),
      expiryDate: new Date('2027-02-01'),
      status: 'active',
      fileUrl: '/documents/dpa-v1.5.pdf',
      uploadedBy: 'Legal Counsel'
    },
    {
      id: 'DOC-003',
      name: 'Service Level Agreement',
      type: 'contract',
      category: 'Operations',
      version: '3.0',
      effectiveDate: new Date('2026-03-01'),
      expiryDate: new Date('2027-03-01'),
      status: 'active',
      fileUrl: '/documents/sla-v3.pdf',
      uploadedBy: 'Operations Manager'
    },
    {
      id: 'DOC-004',
      name: 'ISO 27001 Certificate',
      type: 'certificate',
      category: 'Compliance',
      version: '2024',
      effectiveDate: new Date('2024-06-01'),
      expiryDate: new Date('2027-06-01'),
      status: 'active',
      fileUrl: '/documents/iso27001-cert.pdf',
      uploadedBy: 'Compliance Officer'
    }
  ];

  const documentReminders: DocumentReminder[] = [
    {
      id: 'REM-001',
      documentId: 'DOC-002',
      documentName: 'Data Processing Agreement',
      reminderType: 'renewal',
      dueDate: new Date('2027-01-15'),
      status: 'pending'
    },
    {
      id: 'REM-002',
      documentId: 'DOC-003',
      documentName: 'Service Level Agreement',
      reminderType: 'renewal',
      dueDate: new Date('2027-02-15'),
      status: 'pending'
    },
    {
      id: 'REM-003',
      documentId: 'DOC-004',
      documentName: 'ISO 27001 Certificate',
      reminderType: 'renewal',
      dueDate: new Date('2027-05-01'),
      status: 'pending'
    }
  ];

  const thirdPartyAgreements: ThirdPartyAgreement[] = [
    {
      id: 'TPA-001',
      name: 'Cloud Infrastructure Agreement',
      type: 'data_processing',
      category: 'Infrastructure',
      effectiveDate: new Date('2026-01-01'),
      expiryDate: new Date('2027-01-01'),
      status: 'active',
      vendor: 'Cloud Provider Inc.',
      riskLevel: 'medium'
    },
    {
      id: 'TPA-002',
      name: 'Payment Gateway Agreement',
      type: 'vendor',
      category: 'Payments',
      effectiveDate: new Date('2026-02-01'),
      expiryDate: new Date('2027-02-01'),
      status: 'active',
      vendor: 'Payment Solutions Ltd.',
      riskLevel: 'high'
    },
    {
      id: 'TPA-003',
      name: 'SMS Service Agreement',
      type: 'service_level',
      category: 'Communications',
      effectiveDate: new Date('2026-03-01'),
      expiryDate: new Date('2026-12-01'),
      status: 'expiring',
      vendor: 'SMS Gateway Co.',
      riskLevel: 'low'
    }
  ];

  const legalHolds: LegalHold[] = [
    {
      id: 'LH-001',
      name: 'Audit 2026',
      description: 'Legal hold for annual audit',
      reason: 'Annual financial audit',
      status: 'active',
      createdDate: new Date('2026-05-01'),
      expiryDate: new Date('2026-08-31'),
      affectedDocuments: 25
    },
    {
      id: 'LH-002',
      name: 'Litigation Hold',
      description: 'Legal hold for pending litigation',
      reason: 'Pending lawsuit',
      status: 'active',
      createdDate: new Date('2026-04-15'),
      affectedDocuments: 12
    }
  ];

  const filteredRequirements = legalRequirements.filter(requirement => {
    const matchesSearch = requirement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         requirement.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || requirement.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'active':
      case 'sent':
      case 'acknowledged':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'non_compliant':
      case 'expired':
      case 'terminated':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'pending_review':
      case 'pending':
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'expiring':
        return <Badge className="bg-warning/10 text-warning border-orange-300"><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'archived':
      case 'released':
        return <Badge className="bg-secondary-background text-gray-800 border-gray-300">{status}</Badge>;
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

  const getDocumentTypeBadge = (type: string) => {
    switch (type) {
      case 'policy':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><FileText className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'contract':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><FileSignature className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'agreement':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Briefcase className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'certificate':
        return <Badge variant="outline" className="text-yellow-300 border-yellow-700"><Shield className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalRequirements = legalRequirements.length;
  const compliantRequirements = legalRequirements.filter(r => r.status === 'compliant').length;
  const pendingReview = legalRequirements.filter(r => r.status === 'pending_review').length;
  const activeAgreements = thirdPartyAgreements.filter(a => a.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Legal Audit Documentation</h2>
          <p className="text-warning/70 text-sm mt-1">Manage legal requirements, documents, and audit trails</p>
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
            Upload Document
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-warning" />
              Legal Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalRequirements}</div>
            <div className="text-sm text-warning/70">Total requirements</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-warning" />
              Compliant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{compliantRequirements}</div>
            <div className="text-sm text-warning/70">Meeting requirements</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{pendingReview}</div>
            <div className="text-sm text-warning/70">Need attention</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-warning" />
              Active Agreements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeAgreements}</div>
            <div className="text-sm text-warning/70">Third-party contracts</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            Overview
          </TabsTrigger>
          <TabsTrigger value="requirements" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Scale className="h-4 w-4 mr-2" />
            Requirements
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="audit-trail" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Shield className="h-4 w-4 mr-2" />
            Audit Trail
          </TabsTrigger>
          <TabsTrigger value="agreements" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Briefcase className="h-4 w-4 mr-2" />
            Agreements
          </TabsTrigger>
          <TabsTrigger value="legal-holds" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Lock className="h-4 w-4 mr-2" />
            Legal Holds
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  Upcoming Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documentReminders.slice(0, 3).map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                      <div>
                        <span className="text-foreground text-sm">{reminder.documentName}</span>
                        <div className="text-warning/70 text-xs">{reminder.reminderType} - {reminder.dueDate.toLocaleDateString()}</div>
                      </div>
                      {getStatusBadge(reminder.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-warning/15">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Building className="h-5 w-5 text-warning" />
                  Jurisdiction Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <span className="text-foreground text-sm">Kenya</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <span className="text-foreground text-sm">European Union</span>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Compliant</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary-background/60 rounded">
                    <span className="text-foreground text-sm">United States</span>
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Partial</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requirements">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Legal Requirements</CardTitle>
              <CardDescription className="text-warning/70">
                Manage and monitor legal compliance requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search requirements..."
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
                  <option value="data_protection">Data Protection</option>
                  <option value="financial">Financial</option>
                  <option value="employment">Employment</option>
                  <option value="contractual">Contractual</option>
                  <option value="regulatory">Regulatory</option>
                  <option value="industry_specific">Industry Specific</option>
                </select>
              </div>

              {/* Requirements List */}
              <div className="space-y-4">
                {filteredRequirements.map((requirement) => (
                  <div key={requirement.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{requirement.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{requirement.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {requirement.category.replace('_', ' ')}
                          </Badge>
                        </div>
                        {getStatusBadge(requirement.status)}
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{requirement.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {requirement.jurisdiction}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {requirement.responsible}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Review: {requirement.reviewDate.toLocaleDateString()}
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

        <TabsContent value="documents">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Legal Documents</CardTitle>
              <CardDescription className="text-warning/70">
                Manage legal documents and certificates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {legalDocuments.map((document) => (
                  <div key={document.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{document.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{document.id}</span>
                          {getDocumentTypeBadge(document.type)}
                        </div>
                        {getStatusBadge(document.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {document.category}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileSignature className="h-3 w-3" />
                          v{document.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Effective: {document.effectiveDate.toLocaleDateString()}
                        </span>
                        {document.expiryDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {document.expiryDate.toLocaleDateString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {document.uploadedBy}
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

        <TabsContent value="audit-trail">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Audit Trail</CardTitle>
              <CardDescription className="text-warning/70">
                Track all legal compliance activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditTrails.map((trail) => (
                  <div key={trail.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{trail.action}</span>
                          <span className="text-warning/70 text-sm ml-2">{trail.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {trail.entityType}
                          </Badge>
                        </div>
                        <Badge variant="outline" className="text-warning/70 border-warning/30">
                          {trail.entityId}
                        </Badge>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{trail.details}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {trail.performedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {trail.timestamp.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {trail.ipAddress}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreements">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Third-Party Agreements</CardTitle>
              <CardDescription className="text-warning/70">
                Manage vendor and partner agreements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {thirdPartyAgreements.map((agreement) => (
                  <div key={agreement.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{agreement.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{agreement.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {agreement.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRiskBadge(agreement.riskLevel)}
                          {getStatusBadge(agreement.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {agreement.vendor}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {agreement.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Effective: {agreement.effectiveDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires: {agreement.expiryDate.toLocaleDateString()}
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

        <TabsContent value="legal-holds">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Legal Holds</CardTitle>
              <CardDescription className="text-warning/70">
                Manage legal holds on documents and data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {legalHolds.map((hold) => (
                  <div key={hold.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{hold.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{hold.id}</span>
                        </div>
                        {getStatusBadge(hold.status)}
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{hold.description}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Reason: {hold.reason}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {hold.affectedDocuments} documents
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created: {hold.createdDate.toLocaleDateString()}
                        </span>
                        {hold.expiryDate && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {hold.expiryDate.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {hold.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-warning/30 text-warning/80 hover:bg-warning/8"
                      >
                        Release Hold
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

export default LegalAuditDocumentation;
