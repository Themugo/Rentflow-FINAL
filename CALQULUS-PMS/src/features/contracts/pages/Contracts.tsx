/**
 * Contracts.tsx
 *
 * This component has been refactored into a feature-oriented architecture.
 * 
 * Architecture:
 * - ContractsContainer.tsx: Main container managing state and logic
 * - hooks/useContractsUI.ts: UI state management hook
 * - hooks/useContractsData.ts: Data fetching hook (React Query)
 * - services/contracts.service.ts: API calls and business logic
 * - components/*.tsx: Presentation components
 * - dialogs/*.tsx: Reusable dialog components
 *
 * This file is kept for backward compatibility.
 */

export { ContractsContainer as default } from "./ContractsContainer";
