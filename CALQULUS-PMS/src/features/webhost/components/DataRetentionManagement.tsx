// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Database, FileText, Trash2, Clock, AlertTriangle, CheckCircle,
  Download, Upload, Plus, Search, Filter, Calendar, Lock,
  Shield, Archive, AlertCircle, Ban
} from 'lucide-react';

interface RetentionPolicy {
  id: string;
  name: string;
  dataCategory: string;
  dataType: 'personal' | 'financial' | 'operational' | 'legal' | 'security' | 'marketing';
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  retentionPeriod: number;
  retentionReason: string;
  disposalMethod: 'delete' | 'archive' | 'anonymize' | 'secure_delete';
  legalRequirements: string[];
  status: 'active' | 'inactive' | 'pending_review';
  effectiveDate: Date;
  reviewDate: Date;
}

interface DataRecord {
  id: string;
  type: string;
  category: string;
  classification: string;
  createdDate: Date;
  retentionExpiry: Date;
  size: string;
  status: 'active' | 'retained' | 'disposed' | 'pending_disposal';
}

interface LegalHold {
  id: string;
  name: string;
  description: string;
  reason: string;
  status: 'active' | 'released' | 'expired';
  createdDate: Date;
  expiryDate?: Date;
  affectedRecords: number;
}

interface DisposalRecord {
  id: string;
  policyId: string;
  recordId: string;
  disposalDate: Date;
  disposalMethod: string;
  disposedBy: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
}

const DataRetentionManagement = () => {
  const [activeTab, setActiveTab] = useState('policies');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDataType, setSelectedDataType] = useState<string>('all');

  // Mock data - in production, this would come from the data retention API
  const policies: RetentionPolicy[] = [
    {
      id: 'POL-001',
      name: 'Personal Data Retention',
      dataCategory: 'Tenant Personal Information',
      dataType: 'personal',
      classification: 'confidential',
      retentionPeriod: 7,
      retentionReason: 'Legal requirement for tenant records',
      disposalMethod: 'secure_delete',
      legalRequirements: ['GDPR Art. 5(1)(e)', 'Data Protection Act'],
      status: 'active',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-12-31')
    },
    {
      id: 'POL-002',
      name: 'Financial Data Retention',
      dataCategory: 'Payment Transactions',
      dataType: 'financial',
      classification: 'restricted',
      retentionPeriod: 10,
      retentionReason: 'Tax and audit requirements',
      disposalMethod: 'archive',
      legalRequirements: ['Tax Act', 'Financial Regulations'],
      status: 'active',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-12-31')
    },
    {
      id: 'POL-003',
      name: 'Operational Logs Retention',
      dataCategory: 'System Logs',
      dataType: 'operational',
      classification: 'internal',
      retentionPeriod: 2,
      retentionReason: 'Security monitoring and troubleshooting',
      disposalMethod: 'delete',
      legalRequirements: ['Security Standards'],
      status: 'active',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-12-31')
    },
    {
      id: 'POL-004',
      name: 'Legal Documents Retention',
      dataCategory: 'Contracts and Agreements',
      dataType: 'legal',
      classification: 'confidential',
      retentionPeriod: 7,
      retentionReason: 'Contractual and legal obligations',
      disposalMethod: 'archive',
      legalRequirements: ['Contract Law', 'Corporate Governance'],
      status: 'active',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-12-31')
    },
    {
      id: 'POL-005',
      name: 'Security Incidents Retention',
      dataCategory: 'Incident Reports',
      dataType: 'security',
      classification: 'restricted',
      retentionPeriod: 5,
      retentionReason: 'Security analysis and compliance',
      disposalMethod: 'secure_delete',
      legalRequirements: ['Security Standards', 'Incident Response'],
      status: 'active',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-12-31')
    },
    {
      id: 'POL-006',
      name: 'Marketing Data Retention',
      dataCategory: 'Marketing Communications',
      dataType: 'marketing',
      classification: 'internal',
      retentionPeriod: 3,
      retentionReason: 'Marketing analytics and compliance',
      disposalMethod: 'delete',
      legalRequirements: ['Marketing Regulations', 'Privacy Laws'],
      status: 'pending_review',
      effectiveDate: new Date('2026-01-01'),
      reviewDate: new Date('2026-06-30')
    }
  ];

  const records: DataRecord[] = [
    {
      id: 'REC-001',
      type: 'Tenant Profile',
      category: 'Personal Information',
      classification: 'confidential',
      createdDate: new Date('2020-01-15'),
      retentionExpiry: new Date('2027-01-15'),
      size: '2.5 MB',
      status: 'active'
    },
    {
      id: 'REC-002',
      type: 'Payment Transaction',
      category: 'Financial Data',
      classification: 'restricted',
      createdDate: new Date('2016-06-01'),
      retentionExpiry: new Date('2026-06-01'),
      size: '1.2 MB',
      status: 'pending_disposal'
    },
    {
      id: 'REC-003',
      type: 'System Log',
      category: 'Operational Data',
      classification: 'internal',
      createdDate: new Date('2024-01-01'),
      retentionExpiry: new Date('2026-01-01'),
      size: '500 MB',
      status: 'disposed'
    },
    {
      id: 'REC-004',
      type: 'Lease Agreement',
      category: 'Legal Document',
      classification: 'confidential',
      createdDate: new Date('2019-03-20'),
      retentionExpiry: new Date('2026-03-20'),
      size: '3.8 MB',
      status: 'retained'
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
      affectedRecords: 1250
    },
    {
      id: 'LH-002',
      name: 'Litigation Hold',
      description: 'Legal hold for pending litigation',
      reason: 'Pending lawsuit',
      status: 'active',
      createdDate: new Date('2026-04-15'),
      affectedRecords: 450
    },
    {
      id: 'LH-003',
      name: 'Regulatory Investigation',
      description: 'Legal hold for regulatory investigation',
      reason: 'Data protection authority investigation',
      status: 'released',
      createdDate: new Date('2026-02-01'),
      expiryDate: new Date('2026-05-31'),
      affectedRecords: 800
    }
  ];

  const disposalRecords: DisposalRecord[] = [
    {
      id: 'DISP-001',
      policyId: 'POL-003',
      recordId: 'REC-003',
      disposalDate: new Date('2026-01-15'),
      disposalMethod: 'delete',
      disposedBy: 'System',
      verificationStatus: 'verified'
    },
    {
      id: 'DISP-002',
      policyId: 'POL-001',
      recordId: 'REC-005',
      disposalDate: new Date('2026-05-20'),
      disposalMethod: 'secure_delete',
      disposedBy: 'Data Steward',
      verificationStatus: 'verified'
    },
    {
      id: 'DISP-003',
      policyId: 'POL-002',
      recordId: 'REC-006',
      disposalDate: new Date('2026-05-25'),
      disposalMethod: 'archive',
      disposedBy: 'Archive Manager',
      verificationStatus: 'pending'
    }
  ];

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.dataCategory.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedDataType === 'all' || policy.dataType === selectedDataType;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'verified':
      case 'retained':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'pending_review':
      case 'pending':
      case 'pending_disposal':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case 'inactive':
      case 'disposed':
      case 'failed':
        return <Badge className="bg-secondary-background text-gray-800 border-gray-300">{status}</Badge>;
      case 'released':
      case 'expired':
        return <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]">{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDisposalMethodBadge = (method: string) => {
    switch (method) {
      case 'delete':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><Trash2 className="h-3 w-3 mr-1" />Delete</Badge>;
      case 'secure_delete':
        return <Badge variant="outline" className="text-destructive border-red-700"><Shield className="h-3 w-3 mr-1" />Secure Delete</Badge>;
      case 'archive':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><Archive className="h-3 w-3 mr-1" />Archive</Badge>;
      case 'anonymize':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Lock className="h-3 w-3 mr-1" />Anonymize</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
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

  const totalRecords = records.length;
  const activeRecords = records.filter(r => r.status === 'active').length;
  const pendingDisposal = records.filter(r => r.status === 'pending_disposal').length;
  const disposedRecords = records.filter(r => r.status === 'disposed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Retention Management</h2>
          <p className="text-warning/70 text-sm mt-1">Manage data retention policies and disposal</p>
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
            Add Policy
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Database className="h-4 w-4 text-warning" />
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalRecords}</div>
            <div className="text-sm text-warning/70">All data records</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-warning" />
              Active Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeRecords}</div>
            <div className="text-sm text-warning/70">Within retention period</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Pending Disposal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{pendingDisposal}</div>
            <div className="text-sm text-warning/70">Awaiting disposal</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-warning" />
              Disposed Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{disposedRecords}</div>
            <div className="text-sm text-warning/70">Successfully disposed</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="policies" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <FileText className="h-4 w-4 mr-2" />
            Policies
          </TabsTrigger>
          <TabsTrigger value="records" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Database className="h-4 w-4 mr-2" />
            Records
          </TabsTrigger>
          <TabsTrigger value="legal-holds" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Lock className="h-4 w-4 mr-2" />
            Legal Holds
          </TabsTrigger>
          <TabsTrigger value="disposal" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Trash2 className="h-4 w-4 mr-2" />
            Disposal Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policies">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Retention Policies</CardTitle>
              <CardDescription className="text-warning/70">
                Manage data retention policies and schedules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search policies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedDataType}
                  onChange={(e) => setSelectedDataType(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Data Types</option>
                  <option value="personal">Personal</option>
                  <option value="financial">Financial</option>
                  <option value="operational">Operational</option>
                  <option value="legal">Legal</option>
                  <option value="security">Security</option>
                  <option value="marketing">Marketing</option>
                </select>
              </div>

              {/* Policies List */}
              <div className="space-y-4">
                {filteredPolicies.map((policy) => (
                  <div key={policy.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{policy.name}</span>
                          <span className="text-warning/70 text-sm ml-2">{policy.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {policy.dataType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getClassificationBadge(policy.classification)}
                          {getStatusBadge(policy.status)}
                        </div>
                      </div>
                      <p className="text-warning/70 text-sm mb-2">{policy.dataCategory}</p>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Retention: {policy.retentionPeriod} years
                        </span>
                        <span className="flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                          {getDisposalMethodBadge(policy.disposalMethod)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Review: {policy.reviewDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {policy.legalRequirements.length} legal requirements
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

        <TabsContent value="records">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Data Records</CardTitle>
              <CardDescription className="text-warning/70">
                Monitor data records and retention status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{record.type}</span>
                          <span className="text-warning/70 text-sm ml-2">{record.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {record.category}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getClassificationBadge(record.classification)}
                          {getStatusBadge(record.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          Size: {record.size}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created: {record.createdDate.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expiry: {record.retentionExpiry.toLocaleDateString()}
                        </span>
                        {record.status === 'pending_disposal' && (
                          <span className="flex items-center gap-1 text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            Ready for disposal
                          </span>
                        )}
                      </div>
                    </div>
                    {record.status === 'pending_disposal' && (
                      <Button
                        size="sm"
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Dispose
                      </Button>
                    )}
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
                Manage legal holds that override retention policies
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
                          <Lock className="h-3 w-3" />
                          Reason: {hold.reason}
                        </span>
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {hold.affectedRecords} records affected
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

        <TabsContent value="disposal">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Disposal Log</CardTitle>
              <CardDescription className="text-warning/70">
                Track data disposal activities and verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {disposalRecords.map((record) => (
                  <div key={record.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">Disposal Record</span>
                          <span className="text-warning/70 text-sm ml-2">{record.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30">
                            {record.recordId}
                          </Badge>
                        </div>
                        {getStatusBadge(record.verificationStatus)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                          Method: {record.disposalMethod}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          By: {record.disposedBy}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Date: {record.disposalDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Policy: {record.policyId}
                        </span>
                      </div>
                    </div>
                    {record.verificationStatus === 'pending' && (
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Verify
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

export default DataRetentionManagement;
