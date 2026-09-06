import React from 'react';
import { Layout } from '@/shared/components/layout/Layout';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Megaphone, Receipt } from 'lucide-react';
import { DashboardSectionHeader } from "@/features/dashboard/components/DashboardSectionHeader";
import BroadcastCenter from '@/features/communications/BroadcastCenter';
import PhysicalDocumentEntry from '@/features/communications/PhysicalDocumentEntry';

const CommunicationsPage: React.FC = () => (
  <Layout title="Communications" subtitle="Message tenants and record physical invoices & receipts">
    <div className="mb-5">
      <DashboardSectionHeader
        eyebrow="Operations / Communications"
        title="Keep tenants informed"
        description="Send targeted updates and keep physical billing records in the same operational workspace."
      />
    </div>
    <Tabs defaultValue="broadcast" className="space-y-6">
      <TabsList>
        <TabsTrigger value="broadcast" className="gap-2">
          <Megaphone className="h-4 w-4" />
          Broadcast & Messages
        </TabsTrigger>
        <TabsTrigger value="physical" className="gap-2">
          <Receipt className="h-4 w-4" />
          Physical Documents
        </TabsTrigger>
      </TabsList>

      <TabsContent value="broadcast">
        <FeatureGate feature="bulk_sms" featureLabel="Broadcast messaging">
        <BroadcastCenter />
        </FeatureGate>
      </TabsContent>

      <TabsContent value="physical">
        <PhysicalDocumentEntry />
      </TabsContent>
    </Tabs>
  </Layout>
);

export default CommunicationsPage;
