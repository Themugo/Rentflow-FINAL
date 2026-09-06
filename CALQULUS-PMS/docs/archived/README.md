# Archived Documentation

This directory contains archived documentation that is no longer actively maintained but kept for historical reference.

## Why Documents Are Archived

Documents are archived when:
- They contain outdated information
- They've been replaced by structured documentation
- They're superseded by newer versions
- They document deprecated features

## Archive Index

### Audit Reports

| Document | Status | Notes |
|----------|--------|-------|
| [COMPREHENSIVE_AUDIT_REPORT.md](../../COMPREHENSIVE_AUDIT_REPORT.md) | Archived | Superseded by structured ADR system |
| [DATABASE_SECURITY_AUDIT_REPORT.md](../../DATABASE_SECURITY_AUDIT_REPORT.md) | Archived | Integrated into ADR-006 |
| [FULL_SYSTEM_AUDIT_JUNE_2026.md](../../FULL_SYSTEM_AUDIT_JUNE_2026.md) | Archived | Historical audit |
| [SILENT_FAILURE_AUDIT_JUNE_2026.md](../../SILENT_FAILURE_AUDIT_JUNE_2026.md) | Archived | Historical audit |
| [SYSTEM_AUDIT_REPORT.md](../../SYSTEM_AUDIT_REPORT.md) | Archived | Superseded |
| [SYSTEM_AUDIT_REPORT_2026.md](../../SYSTEM_AUDIT_REPORT_2026.md) | Archived | Historical |

### Test Reports

| Document | Status | Notes |
|----------|--------|-------|
| [NOTIFICATION_FLOWS_TEST_REPORT.md](../../NOTIFICATION_FLOWS_TEST_REPORT.md) | Archived | Superseded by integration tests |
| [PAYMENT_FLOW_RECEIPTS_TEST_REPORT.md](../../PAYMENT_FLOW_RECEIPTS_TEST_REPORT.md) | Archived | Superseded by payment tests |

### Migration Documents

| Document | Status | Notes |
|----------|--------|-------|
| [MANAGEMENT_STRUCTURE_MIGRATION_GUIDE.md](../../MANAGEMENT_STRUCTURE_MIGRATION_GUIDE.md) | Archived | Migration complete |
| [MIGRATION_INSTRUCTIONS.md](../../MIGRATION_INSTRUCTIONS.md) | Archived | Integrated into [Deployment Docs](../deployment/README.md) |

### Proposals

| Document | Status | Notes |
|----------|--------|-------|
| [EDGE_FUNCTIONS_REORG_PROPOSAL.md](../docs/EDGE_FUNCTIONS_REORG_PROPOSAL.md) | Archived | Proposal implemented |
| [ENTERPRISE_ROADMAP.md](../../ENTERPRISE_ROADMAP.md) | Archived | Keep in Confluence instead |

## Accessing Archived Documents

```bash
# View archived documents
ls docs/archived/

# Reference from main docs
See [Archived: Old Audit Report](\.\/archived\/\.\.\/COMPREHENSIVE_AUDIT_REPORT\.md\)
```

## Archiving New Documents

To archive a document:

1. Move it to this directory
2. Update this index
3. If possible, create/update an ADR instead
4. Add a redirect or reference in relevant docs

## Document Retention

| Type | Retention |
|------|-----------|
| Audit Reports | 2 years |
| Test Reports | 1 year |
| Migration Guides | After migration complete |
| Proposals | 6 months after decision |

## Review Schedule

Archived documents should be reviewed:
- Quarterly for accuracy
- Annually for deletion decisions
