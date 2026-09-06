// @ts-nocheck — Phase 12: remaining local types until live supabase gen types
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/shared/lib/errorLogger';

// Types for Workflow Orchestration
export interface WorkflowTemplate {
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

export interface WorkflowInstance {
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

export interface WorkflowStep {
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

export interface WorkflowAutomation {
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

// Workflow Orchestration API Service
export const workflowOrchestrationService = {
  /**
   * Fetch all workflow templates with optional filtering
   */
  async getWorkflowTemplates(filters?: {
    category?: string;
    status?: string;
  }): Promise<WorkflowTemplate[]> {
    let query = supabase
      .from('workflow_templates')
      .select('*');

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('last_used', { ascending: false });

    if (error) {
      logError('Error fetching workflow templates:', error);
      return [];
    }

    return (data || []).map(template => ({
      ...template,
      lastUsed: new Date(template.last_used),
    }));
  },

  /**
   * Fetch a single workflow template by ID
   */
  async getWorkflowTemplateById(id: string): Promise<WorkflowTemplate | null> {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logError('Error fetching workflow template:', error);
      return null;
    }

    return data ? {
      ...data,
      lastUsed: new Date(data.last_used),
    } : null;
  },

  /**
   * Create a new workflow template
   */
  async createWorkflowTemplate(template: Omit<WorkflowTemplate, 'id' | 'lastUsed'>): Promise<WorkflowTemplate | null> {
    const { data, error } = await supabase.rpc('save_workflow_template_atomic', { p_id: null, p_payload: { name: template.name, category: template.category, description: template.description, steps: template.steps, average_duration: template.averageDuration, usage_count: template.usageCount, status: template.status, last_used: new Date().toISOString() } });

    if (error) {
      logError('Error creating workflow template:', error);
      return null;
    }

    return data ? {
      ...data,
      lastUsed: new Date(data.last_used),
    } : null;
  },

  /**
   * Update a workflow template
   */
  async updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate | null> {
    const { data, error } = await supabase.rpc('save_workflow_template_atomic', { p_id: id, p_payload: { name: updates.name, description: updates.description, status: updates.status, last_used: updates.lastUsed?.toISOString() } });

    if (error) {
      logError('Error updating workflow template:', error);
      return null;
    }

    return data ? {
      ...data,
      lastUsed: new Date(data.last_used),
    } : null;
  },

  /**
   * Fetch all workflow instances with optional filtering
   */
  async getWorkflowInstances(filters?: {
    status?: string;
    templateId?: string;
    entityType?: string;
  }): Promise<WorkflowInstance[]> {
    let query = supabase
      .from('workflow_instances')
      .select('*');

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.templateId) {
      query = query.eq('template_id', filters.templateId);
    }
    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    const { data, error } = await query.order('started_date', { ascending: false });

    if (error) {
      logError('Error fetching workflow instances:', error);
      return [];
    }

    return (data || []).map(instance => ({
      ...instance,
      templateId: instance.template_id,
      entityId: instance.entity_id,
      entityType: instance.entity_type,
      startedDate: new Date(instance.started_date),
      completedDate: instance.completed_date ? new Date(instance.completed_date) : undefined,
      estimatedCompletion: instance.estimated_completion ? new Date(instance.estimated_completion) : undefined,
    }));
  },

  /**
   * Create a new workflow instance
   */
  async createWorkflowInstance(instance: Omit<WorkflowInstance, 'id' | 'startedDate'>): Promise<WorkflowInstance | null> {
    const { data, error } = await supabase.rpc('save_workflow_instance_atomic', { p_id: null, p_payload: { template_id: instance.templateId, entity_id: instance.entityId, entity_name: instance.entityName, entity_type: instance.entityType, status: instance.status, current_step: instance.currentStep, total_steps: instance.totalSteps, progress: instance.progress, assignee: instance.assignee, estimated_completion: instance.estimatedCompletion?.toISOString() } });

    if (error) {
      logError('Error creating workflow instance:', error);
      return null;
    }

    return data ? {
      ...data,
      templateId: data.template_id,
      entityId: data.entity_id,
      entityType: data.entity_type,
      startedDate: new Date(data.started_date),
      completedDate: data.completed_date ? new Date(data.completed_date) : undefined,
      estimatedCompletion: data.estimated_completion ? new Date(data.estimated_completion) : undefined,
    } : null;
  },

  /**
   * Update a workflow instance
   */
  async updateWorkflowInstance(id: string, updates: Partial<WorkflowInstance>): Promise<WorkflowInstance | null> {
    const { data, error } = await supabase.rpc('save_workflow_instance_atomic', { p_id: id, p_payload: { status: updates.status, current_step: updates.currentStep, progress: updates.progress, completed_date: updates.completedDate?.toISOString(), estimated_completion: updates.estimatedCompletion?.toISOString() } });

    if (error) {
      logError('Error updating workflow instance:', error);
      return null;
    }

    return data ? {
      ...data,
      templateId: data.template_id,
      entityId: data.entity_id,
      entityType: data.entity_type,
      startedDate: new Date(data.started_date),
      completedDate: data.completed_date ? new Date(data.completed_date) : undefined,
      estimatedCompletion: data.estimated_completion ? new Date(data.estimated_completion) : undefined,
    } : null;
  },

  /**
   * Fetch workflow steps for a specific instance
   */
  async getWorkflowSteps(workflowInstanceId: string): Promise<WorkflowStep[]> {
    const { data, error } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_instance_id', workflowInstanceId)
      .order('step_number', { ascending: true });

    if (error) {
      logError('Error fetching workflow steps:', error);
      return [];
    }

    return (data || []).map(step => ({
      ...step,
      workflowInstanceId: step.workflow_instance_id,
      startedDate: step.started_date ? new Date(step.started_date) : undefined,
      completedDate: step.completed_date ? new Date(step.completed_date) : undefined,
    }));
  },

  /**
   * Create a new workflow step
   */
  async createWorkflowStep(step: Omit<WorkflowStep, 'id'>): Promise<WorkflowStep | null> {
    const { data, error } = await supabase.rpc('save_workflow_step_atomic', { p_id: null, p_payload: { workflow_instance_id: step.workflowInstanceId, step_number: step.stepNumber, name: step.name, description: step.description, type: step.type, status: step.status, assignee: step.assignee, started_date: step.startedDate?.toISOString(), completed_date: step.completedDate?.toISOString() } });

    if (error) {
      logError('Error creating workflow step:', error);
      return null;
    }

    return data ? {
      ...data,
      workflowInstanceId: data.workflow_instance_id,
      startedDate: data.started_date ? new Date(data.started_date) : undefined,
      completedDate: data.completed_date ? new Date(data.completed_date) : undefined,
    } : null;
  },

  /**
   * Update a workflow step
   */
  async updateWorkflowStep(id: string, updates: Partial<WorkflowStep>): Promise<WorkflowStep | null> {
    const { data, error } = await supabase.rpc('save_workflow_step_atomic', { p_id: id, p_payload: { status: updates.status, assignee: updates.assignee, started_date: updates.startedDate?.toISOString(), completed_date: updates.completedDate?.toISOString() } });

    if (error) {
      logError('Error updating workflow step:', error);
      return null;
    }

    return data ? {
      ...data,
      workflowInstanceId: data.workflow_instance_id,
      startedDate: data.started_date ? new Date(data.started_date) : undefined,
      completedDate: data.completed_date ? new Date(data.completed_date) : undefined,
    } : null;
  },

  /**
   * Fetch all workflow automations
   */
  async getWorkflowAutomations(): Promise<WorkflowAutomation[]> {
    const { data, error } = await supabase
      .from('workflow_automations')
      .select('*');

    if (error) {
      logError('Error fetching workflow automations:', error);
      return [];
    }

    return (data || []).map(automation => ({
      ...automation,
      lastRun: new Date(automation.last_run),
      nextRun: new Date(automation.next_run),
    }));
  },

  /**
   * Create a new workflow automation
   */
  async createWorkflowAutomation(automation: Omit<WorkflowAutomation, 'id' | 'lastRun' | 'nextRun'>): Promise<WorkflowAutomation | null> {
    const { data, error } = await supabase.rpc('save_workflow_automation_atomic', { p_id: null, p_payload: { name: automation.name, trigger: automation.trigger, action: automation.action, target: automation.target, frequency: automation.frequency, status: automation.status, success_rate: automation.successRate, last_run: new Date().toISOString(), next_run: new Date().toISOString() } });

    if (error) {
      logError('Error creating workflow automation:', error);
      return null;
    }

    return data ? {
      ...data,
      lastRun: new Date(data.last_run),
      nextRun: new Date(data.next_run),
    } : null;
  },

  /**
   * Update a workflow automation
   */
  async updateWorkflowAutomation(id: string, updates: Partial<WorkflowAutomation>): Promise<WorkflowAutomation | null> {
    const { data, error } = await supabase.rpc('save_workflow_automation_atomic', { p_id: id, p_payload: { status: updates.status, last_run: updates.lastRun?.toISOString(), next_run: updates.nextRun?.toISOString(), success_rate: updates.successRate } });

    if (error) {
      logError('Error updating workflow automation:', error);
      return null;
    }

    return data ? {
      ...data,
      lastRun: new Date(data.last_run),
      nextRun: new Date(data.next_run),
    } : null;
  },

  /**
   * Start a workflow from a template
   */
  async startWorkflow(templateId: string, entityId: string, entityName: string, entityType: string, assignee: string): Promise<WorkflowInstance | null> {
    // Get the template
    const template = await this.getWorkflowTemplateById(templateId);
    if (!template) return null;

    // Create a new instance
    const instance = await this.createWorkflowInstance({
      templateId,
      templateName: template.name,
      entityId,
      entityName,
      entityType,
      status: 'running',
      currentStep: 1,
      totalSteps: template.steps,
      progress: 0,
      assignee,
      estimatedCompletion: new Date(Date.now() + 86400000), // +1 day placeholder
    });

    return instance;
  },

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(instanceId: string): Promise<boolean> {
    const { error } = await supabase.rpc('save_workflow_instance_atomic', { p_id: instanceId, p_payload: { status: 'paused' } });

    if (error) {
      logError('Error pausing workflow:', error);
      return false;
    }

    return true;
  },

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(instanceId: string): Promise<boolean> {
    const { error } = await supabase.rpc('save_workflow_instance_atomic', { p_id: instanceId, p_payload: { status: 'running' } });

    if (error) {
      logError('Error resuming workflow:', error);
      return false;
    }

    return true;
  },

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(instanceId: string): Promise<boolean> {
    const { error } = await supabase.rpc('save_workflow_instance_atomic', { p_id: instanceId, p_payload: { status: 'cancelled' } });

    if (error) {
      logError('Error cancelling workflow:', error);
      return false;
    }

    return true;
  },

  /**
   * Pause a workflow automation
   */
  async pauseAutomation(automationId: string): Promise<boolean> {
    const { error } = await supabase.rpc('save_workflow_automation_atomic', { p_id: automationId, p_payload: { status: 'paused' } });

    if (error) {
      logError('Error pausing automation:', error);
      return false;
    }

    return true;
  },

  /**
   * Activate a workflow automation
   */
  async activateAutomation(automationId: string): Promise<boolean> {
    const { error } = await supabase.rpc('save_workflow_automation_atomic', { p_id: automationId, p_payload: { status: 'active' } });

    if (error) {
      logError('Error activating automation:', error);
      return false;
    }

    return true;
  },
};
