import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import {
  Building2, Search, Filter, Download, RefreshCw, Star, MapPin,
  Calendar, DollarSign, CheckCircle, AlertTriangle, Clock, User,
  Activity, TrendingUp, Award, Shield, FileText, Briefcase, CreditCard,
  Percent, Target, Zap
} from 'lucide-react';

interface FinancialPartner {
  id: string;
  name: string;
  type: 'bank' | 'microfinance' | 'fintech' | 'investment';
  rating: number;
  reviewCount: number;
  totalLoans: number;
  activeLoans: number;
  location: string;
  interestRateRange: string;
  loanAmountRange: string;
  approvalRate: number;
  averageProcessingTime: string;
  verified: boolean;
  services: string[];
}

interface LoanApplication {
  id: string;
  partnerId: string;
  partnerName: string;
  propertyId: string;
  propertyName: string;
  applicantName: string;
  amount: number;
  purpose: string;
  term: number;
  interestRate: number;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'disbursed' | 'repaid';
  submittedDate: Date;
  approvedDate?: Date;
  disbursedDate?: Date;
  repaymentStartDate?: Date;
  monthlyPayment: number;
  totalRepayment: number;
}

interface PaymentProcessing {
  id: string;
  partnerId: string;
  partnerName: string;
  type: 'mpesa' | 'card' | 'bank_transfer' | 'mobile_money';
  status: 'active' | 'inactive' | 'pending';
  transactionFee: number;
  processingTime: string;
  dailyLimit: number;
  monthlyLimit: number;
  setupDate: Date;
  lastTransactionDate?: Date;
}

interface PartnerPerformance {
  partnerId: string;
  partnerName: string;
  approvalRate: number;
  averageInterestRate: number;
  disbursementSpeed: string;
  customerSatisfaction: number;
  defaultRate: number;
  totalVolume: number;
}

const FinancialPartners = () => {
  const [activeTab, setActiveTab] = useState('partners');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Mock data - in production, this would come from the financial partners API
  const financialPartners: FinancialPartner[] = [
    {
      id: 'FP-001',
      name: 'Equity Bank',
      type: 'bank',
      rating: 4.7,
      reviewCount: 234,
      totalLoans: 567,
      activeLoans: 89,
      location: 'Nairobi',
      interestRateRange: '12-16%',
      loanAmountRange: 'KES 100K - 10M',
      approvalRate: 78,
      averageProcessingTime: '5-7 days',
      verified: true,
      services: ['Property Loans', 'Construction Loans', 'Bridge Financing']
    },
    {
      id: 'FP-002',
      name: 'M-Pesa Financial Services',
      type: 'fintech',
      rating: 4.5,
      reviewCount: 189,
      totalLoans: 423,
      activeLoans: 156,
      location: 'Nairobi',
      interestRateRange: '8-12%',
      loanAmountRange: 'KES 10K - 500K',
      approvalRate: 92,
      averageProcessingTime: '1-2 days',
      verified: true,
      services: ['Quick Loans', 'Micro Loans', 'Emergency Financing']
    },
    {
      id: 'FP-003',
      name: 'Kenya Commercial Bank',
      type: 'bank',
      rating: 4.8,
      reviewCount: 312,
      totalLoans: 789,
      activeLoans: 123,
      location: 'Nairobi',
      interestRateRange: '11-15%',
      loanAmountRange: 'KES 500K - 50M',
      approvalRate: 82,
      averageProcessingTime: '7-10 days',
      verified: true,
      services: ['Property Development', 'Commercial Loans', 'Mortgage']
    },
    {
      id: 'FP-004',
      name: 'Branch International',
      type: 'microfinance',
      rating: 4.4,
      reviewCount: 156,
      totalLoans: 345,
      activeLoans: 67,
      location: 'Nairobi',
      interestRateRange: '14-18%',
      loanAmountRange: 'KES 50K - 2M',
      approvalRate: 85,
      averageProcessingTime: '3-5 days',
      verified: true,
      services: ['SME Loans', 'Asset Financing', 'Working Capital']
    },
    {
      id: 'FP-005',
      name: 'Tala Kenya',
      type: 'fintech',
      rating: 4.3,
      reviewCount: 445,
      totalLoans: 1234,
      activeLoans: 234,
      location: 'Nairobi',
      interestRateRange: '10-15%',
      loanAmountRange: 'KES 5K - 100K',
      approvalRate: 95,
      averageProcessingTime: '1 day',
      verified: true,
      services: ['Instant Loans', 'Mobile Loans', 'Credit Building']
    }
  ];

  const loanApplications: LoanApplication[] = [
    {
      id: 'LA-001',
      partnerId: 'FP-001',
      partnerName: 'Equity Bank',
      propertyId: 'PROP-001',
      propertyName: 'Sunset Apartments',
      applicantName: 'John Kamau',
      amount: 5000000,
      purpose: 'property_improvement',
      term: 36,
      interestRate: 14,
      status: 'approved',
      submittedDate: new Date('2026-05-15'),
      approvedDate: new Date('2026-05-28'),
      monthlyPayment: 150000,
      totalRepayment: 5400000
    },
    {
      id: 'LA-002',
      partnerId: 'FP-002',
      partnerName: 'M-Pesa Financial Services',
      propertyId: 'PROP-002',
      propertyName: 'Riverside Complex',
      applicantName: 'Mary Wanjiku',
      amount: 100000,
      purpose: 'emergency_repair',
      term: 12,
      interestRate: 12,
      status: 'disbursed',
      submittedDate: new Date('2026-05-20'),
      approvedDate: new Date('2026-05-21'),
      disbursedDate: new Date('2026-05-22'),
      monthlyPayment: 9000,
      totalRepayment: 108000
    },
    {
      id: 'LA-003',
      partnerId: 'FP-003',
      partnerName: 'Kenya Commercial Bank',
      propertyId: 'PROP-003',
      propertyName: 'Garden View',
      applicantName: 'Peter Ochieng',
      amount: 15000000,
      purpose: 'property_development',
      term: 60,
      interestRate: 13,
      status: 'under_review',
      submittedDate: new Date('2026-06-01'),
      monthlyPayment: 350000,
      totalRepayment: 21000000
    }
  ];

  const paymentProcessing: PaymentProcessing[] = [
    {
      id: 'PP-001',
      partnerId: 'MPESA',
      partnerName: 'Safaricom M-Pesa',
      type: 'mpesa',
      status: 'active',
      transactionFee: 0.5,
      processingTime: 'Instant',
      dailyLimit: 150000,
      monthlyLimit: 3000000,
      setupDate: new Date('2025-01-15'),
      lastTransactionDate: new Date('2026-06-03')
    },
    {
      id: 'PP-002',
      partnerId: 'CARD',
      partnerName: 'Visa/Mastercard',
      type: 'card',
      status: 'active',
      transactionFee: 2.5,
      processingTime: '2-3 days',
      dailyLimit: 500000,
      monthlyLimit: 10000000,
      setupDate: new Date('2025-02-20'),
      lastTransactionDate: new Date('2026-06-02')
    },
    {
      id: 'PP-003',
      partnerId: 'BANK',
      partnerName: 'Equity Bank Transfer',
      type: 'bank_transfer',
      status: 'active',
      transactionFee: 0,
      processingTime: '1-2 days',
      dailyLimit: 1000000,
      monthlyLimit: 20000000,
      setupDate: new Date('2025-03-10'),
      lastTransactionDate: new Date('2026-06-01')
    }
  ];

  const partnerPerformance: PartnerPerformance[] = [
    {
      partnerId: 'FP-001',
      partnerName: 'Equity Bank',
      approvalRate: 78,
      averageInterestRate: 14,
      disbursementSpeed: '5-7 days',
      customerSatisfaction: 4.7,
      defaultRate: 3.2,
      totalVolume: 45000000
    },
    {
      partnerId: 'FP-002',
      partnerName: 'M-Pesa Financial Services',
      approvalRate: 92,
      averageInterestRate: 10,
      disbursementSpeed: '1-2 days',
      customerSatisfaction: 4.5,
      defaultRate: 5.8,
      totalVolume: 25000000
    },
    {
      partnerId: 'FP-003',
      partnerName: 'Kenya Commercial Bank',
      approvalRate: 82,
      averageInterestRate: 13,
      disbursementSpeed: '7-10 days',
      customerSatisfaction: 4.8,
      defaultRate: 2.5,
      totalVolume: 67000000
    }
  ];

  const filteredPartners = financialPartners.filter(partner => {
    const matchesSearch = partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         partner.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || partner.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
      case 'disbursed':
      case 'repaid':
        return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'under_review':
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="h-3 w-3 mr-1" />{status.replace('_', ' ')}</Badge>;
      case 'rejected':
      case 'inactive':
        return <Badge className="bg-destructive/15 text-destructive border-red-300"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'bank':
        return <Badge variant="outline" className="text-[hsl(214_73%_65%)] border-[hsl(214_73%_40%)]"><Building2 className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'microfinance':
        return <Badge variant="outline" className="text-green-300 border-green-700"><Building2 className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'fintech':
        return <Badge variant="outline" className="text-warning/70 border-warning/30"><Zap className="h-3 w-3 mr-1" />{type}</Badge>;
      case 'investment':
        return <Badge variant="outline" className="text-yellow-300 border-yellow-700"><TrendingUp className="h-3 w-3 mr-1" />{type}</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalPartners = financialPartners.length;
  const activeLoans = loanApplications.filter(l => l.status === 'disbursed').length;
  const pendingApplications = loanApplications.filter(l => l.status === 'pending' || l.status === 'under_review').length;
  const totalLoanVolume = loanApplications.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Financial Partners</h2>
          <p className="text-warning/70 text-sm mt-1">Connect with banks and financial institutions for loans and payment processing</p>
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
              <Building2 className="h-4 w-4 text-warning" />
              Total Partners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalPartners}</div>
            <div className="text-sm text-warning/70">Financial institutions</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-warning" />
              Active Loans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{activeLoans}</div>
            <div className="text-sm text-warning/70">Currently active</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Pending Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{pendingApplications}</div>
            <div className="text-sm text-warning/70">Awaiting review</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-warning/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-warning" />
              Total Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">KES {(totalLoanVolume / 1000000).toFixed(1)}M</div>
            <div className="text-sm text-warning/70">Loan portfolio</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for detailed views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-card/80 border border-warning/12">
          <TabsTrigger value="partners" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Building2 className="h-4 w-4 mr-2" />
            Partners
          </TabsTrigger>
          <TabsTrigger value="loans" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <FileText className="h-4 w-4 mr-2" />
            Loan Applications
          </TabsTrigger>
          <TabsTrigger value="payments" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <CreditCard className="h-4 w-4 mr-2" />
            Payment Processing
          </TabsTrigger>
          <TabsTrigger value="performance" className="data-[state=active]:bg-primary data-[state=active]:text-white text-warning/70">
            <Award className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Financial Partners Directory</CardTitle>
              <CardDescription className="text-warning/70">
                Browse and connect with financial institutions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-warning" />
                  <Input
                    placeholder="Search partners..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-secondary-background/60 border-warning/12 text-foreground placeholder-[hsl(218_58%_60%)]"
                  />
                </div>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-secondary-background/60 border border-warning/12 text-foreground rounded-md px-3 py-2"
                >
                  <option value="all">All Types</option>
                  <option value="bank">Bank</option>
                  <option value="microfinance">Microfinance</option>
                  <option value="fintech">Fintech</option>
                  <option value="investment">Investment</option>
                </select>
              </div>

              {/* Partners List */}
              <div className="grid gap-4 md:grid-cols-2">
                {filteredPartners.map((partner) => (
                  <div key={partner.id} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-foreground font-medium">{partner.name}</span>
                          {partner.verified && (
                            <Badge className="bg-[hsl(214_73%_48%/0.12)] text-[hsl(214_73%_35%)] border-[hsl(214_73%_48%/0.3)]"><Shield className="h-3 w-3 mr-1" />Verified</Badge>
                          )}
                        </div>
                        {getTypeBadge(partner.type)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                        <span className="text-foreground font-medium">{partner.rating}</span>
                        <span className="text-warning/70 text-sm">({partner.reviewCount})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {partner.services.slice(0, 3).map((service, idx) => (
                        <Badge key={idx} variant="outline" className="text-warning/70 border-warning/30 text-xs">
                          {service}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div className="flex items-center gap-2 text-warning/70">
                        <MapPin className="h-3 w-3" />
                        {partner.location}
                      </div>
                      <div className="flex items-center gap-2 text-warning/70">
                        <Percent className="h-3 w-3" />
                        {partner.interestRateRange}
                      </div>
                      <div className="flex items-center gap-2 text-warning/70">
                        <DollarSign className="h-3 w-3" />
                        {partner.loanAmountRange}
                      </div>
                      <div className="flex items-center gap-2 text-warning/70">
                        <Clock className="h-3 w-3" />
                        {partner.averageProcessingTime}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-warning/70">
                        <Target className="h-3 w-3" />
                        Approval: {partner.approvalRate}%
                      </div>
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Apply for Loan
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Loan Applications</CardTitle>
              <CardDescription className="text-warning/70">
                Manage loan applications and track status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loanApplications.map((application) => (
                  <div key={application.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{application.partnerName}</span>
                          <span className="text-warning/70 text-sm ml-2">{application.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(application.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {application.applicantName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {application.propertyName}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Amount: KES {application.amount.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Interest: {application.interestRate}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Term: {application.term} months
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Monthly: KES {application.monthlyPayment.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Total: KES {application.totalRepayment.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {application.status === 'approved' && (
                      <Button variant="outline" size="sm" className="border-green-700 text-green-300 hover:bg-green-900/50">
                        Accept Loan
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="bg-card border-warning/15">
            <CardHeader>
              <CardTitle className="text-foreground">Payment Processing</CardTitle>
              <CardDescription className="text-warning/70">
                Manage payment processing partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentProcessing.map((processing) => (
                  <div key={processing.id} className="flex items-center gap-4 p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-foreground font-medium">{processing.partnerName}</span>
                          <span className="text-warning/70 text-sm ml-2">{processing.id}</span>
                          <Badge variant="outline" className="ml-2 text-warning/70 border-warning/30 capitalize">
                            {processing.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(processing.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          Fee: {processing.transactionFee}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Processing: {processing.processingTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70 mb-2">
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Daily Limit: KES {processing.dailyLimit.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Monthly Limit: KES {processing.monthlyLimit.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-warning/70">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Setup: {processing.setupDate.toLocaleDateString()}
                        </span>
                        {processing.lastTransactionDate && (
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            Last: {processing.lastTransactionDate.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {processing.status === 'inactive' && (
                      <Button variant="outline" size="sm" className="border-warning/30 text-warning/80 hover:bg-warning/8">
                        Activate
                      </Button>
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
              <CardTitle className="text-foreground">Partner Performance</CardTitle>
              <CardDescription className="text-warning/70">
                Track financial partner performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {partnerPerformance.map((perf) => (
                  <div key={perf.partnerId} className="p-4 bg-secondary-background/60 rounded-lg border border-warning/12">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-foreground font-medium">{perf.partnerName}</span>
                      <Badge variant="outline" className="text-warning/70 border-warning/30">
                        KES {(perf.totalVolume / 1000000).toFixed(1)}M volume
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-3">
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.approvalRate}%</div>
                        <div className="text-xs text-warning/70">Approval Rate</div>
                        <Progress value={perf.approvalRate} className="h-2 mt-1" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.averageInterestRate}%</div>
                        <div className="text-xs text-warning/70">Avg Interest</div>
                        <Progress value={perf.averageInterestRate * 5} className="h-2 mt-1" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.customerSatisfaction}/5</div>
                        <div className="text-xs text-warning/70">Satisfaction</div>
                        <Progress value={(perf.customerSatisfaction / 5) * 100} className="h-2 mt-1" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-foreground">{perf.defaultRate}%</div>
                        <div className="text-xs text-warning/70">Default Rate</div>
                        <Progress value={perf.defaultRate * 10} className="h-2 mt-1" />
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-warning/70">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Disbursement: {perf.disbursementSpeed}
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

export default FinancialPartners;
