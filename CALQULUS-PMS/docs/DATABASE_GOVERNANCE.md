# Database Governance Guide

This document establishes database governance policies and procedures for CALQULUS PMS to ensure data integrity, security, and compliance.

## Governance Principles

### Core Principles
1. **Data Integrity**: Maintain accuracy and consistency of data
2. **Security**: Protect sensitive data through access controls
3. **Compliance**: Adhere to regulatory requirements (GDPR, PCI DSS)
4. **Transparency**: Document all database changes and access
5. **Accountability**: Track and audit all database operations
6. **Performance**: Maintain optimal database performance
7. **Availability**: Ensure high availability and disaster recovery

### Scope
- All Supabase PostgreSQL databases
- All database migrations and schema changes
- All data access patterns and RLS policies
- All backup and recovery procedures
- All monitoring and alerting systems

---

## Migration Management

### Migration Development Standards

#### Naming Convention
- Format: `YYYYMMDDHHMMSS_description.sql`
- Description: Lowercase with underscores
- Maximum length: 64 characters
- Example: `20260601000000_enforce_management_structure.sql`

#### Migration Structure
```sql

-- Migration: [Description]
-- Author: [Author Name]
-- Date: [YYYY-MM-DD]
-- Ticket: [JIRA/Ticket Number]
-- Risk Level: [LOW/MEDIUM/HIGH]

-- [Description of changes]


-- Migration SQL here

-- Verification queries
SELECT [verification query];
```

#### Migration Categories
- **Schema**: Table creation, column changes, constraints
- **Data**: Data migration, updates, deletions
- **Security**: RLS policies, roles, permissions
- **Performance**: Indexes, optimizations
- **Bug Fix**: Corrections to previous issues

### Migration Review Process

#### Pre-Review Checklist
- [ ] Migration follows naming convention
- [ ] Migration includes proper documentation
- [ ] Risk level assessed and documented
- [ ] Rollback script created (if applicable)
- [ ] Tested in staging environment
- [ ] Performance impact assessed
- [ ] Security implications reviewed
- [ ] Data backup created before execution

#### Review Approval Levels
- **LOW Risk**: Single reviewer approval
- **MEDIUM Risk**: Two reviewer approvals
- **HIGH Risk**: Three reviewer approvals + manager approval

#### Review Timeline
- **LOW Risk**: 1 business day
- **MEDIUM Risk**: 2 business days
- **HIGH Risk**: 3 business days

### Migration Deployment

#### Deployment Windows
- **Production**: Sunday 2:00 AM - 4:00 AM UTC
- **Staging**: Anytime during business hours
- **Development**: Anytime

#### Deployment Process
1. Create database backup
2. Run pre-deployment checks
3. Execute migration in staging
4. Verify application functionality
5. Schedule production deployment
6. Notify stakeholders
7. Execute production migration
8. Verify production functionality
9. Monitor for issues
10. Document deployment results

#### Deployment Rollback
- Immediate rollback if critical issues detected
- Partial rollback if specific features affected
- Full restore from backup if rollback fails

---

## Schema Management

### Schema Change Policies

#### Additive Changes
- **Policy**: Always prefer additive changes
- **Examples**: ADD COLUMN, ADD INDEX, CREATE TABLE
- **Approval**: Single reviewer
- **Rollback**: Required

#### Destructive Changes
- **Policy**: Minimize destructive changes
- **Examples**: DROP COLUMN, DROP TABLE, DROP INDEX
- **Approval**: Three reviewers + manager
- **Rollback**: Required with data backup
- **Notification**: 7 days advance notice

#### Data Type Changes
- **Policy**: Avoid breaking changes
- **Examples**: Changing column data types
- **Approval**: Two reviewers
- **Rollback**: Required
- **Migration**: Use intermediate types if needed

### Table Design Standards

#### Naming Conventions
- **Tables**: snake_case, plural (e.g., `tenants`, `properties`)
- **Columns**: snake_case (e.g., `created_at`, `user_id`)
- **Indexes**: `idx_table_name` (e.g., `idx_tenants_email`)
- **Constraints**: `table_name_constraint` (e.g., `tenants_email_unique`)
- **Functions**: snake_case (e.g., `calculate_rent`)

#### Required Columns
- **id**: UUID primary key with default `gen_random_uuid()`
- **created_at**: timestamptz with default `now()`
- **updated_at**: timestamptz with default `now()` and trigger for updates

#### Foreign Key Standards
- **Naming**: `{table}_id` pattern
- **Constraints**: ON DELETE behavior specified
- **Indexes**: Create indexes on foreign keys
- **Nullable**: Specify NULL or NOT NULL explicitly

### Index Management

#### Index Creation Guidelines
- **Purpose**: Performance optimization
- **Selective**: Index only columns used in WHERE/JOIN clauses
- **Monitoring**: Track index usage and size
- **Maintenance**: Rebuild indexes when fragmentation > 30%

#### Index Types
- **B-tree**: Default for equality and range queries
- **Hash**: For equality comparisons only
- **GIN**: For array and JSONB data
- **Partial**: For filtered indexes

#### Index Review
- **Quarterly**: Review unused indexes
- **Monthly**: Monitor index size and performance
- **On-Demand**: Review after major schema changes

---

## Data Security

### Access Control

#### Row Level Security (RLS)
- **Policy**: Enable RLS on all tables
- **Default**: Deny all access
- **Exceptions**: Service role bypass
- **Review**: Quarterly policy review

#### Role-Based Access
- **Roles**: manager, tenant, landlord, webhost, agency, submanager
- **Principle**: Least privilege access
- **Review**: Quarterly role review
- **Audit**: Log all role changes

#### Authentication
- **Method**: Supabase Auth
- **MFA**: Required for admin roles
- **Session**: 24-hour session timeout
- **Audit**: Log all authentication events

### Data Classification

#### Classification Levels
- **Public**: Non-sensitive data (property names, addresses)
- **Internal**: Business data (revenue, occupancy rates)
- **Confidential**: User PII (emails, phone numbers)
- **Restricted**: Financial data (payment details, bank accounts)

#### Data Handling
- **Public**: No special handling
- **Internal**: Internal access only
- **Confidential**: Encryption at rest and in transit
- **Restricted**: Strict access controls and audit logging

### Data Masking
- **Policy**: Mask sensitive data in logs
- **Email**: `user***@example.com`
- **Phone**: `+2547***1234`
- **PII**: Never log full personal information
- **Audit**: Log all data access

---

## Data Integrity

### Constraints

#### Required Constraints
- **Primary Keys**: All tables must have primary key
- **Foreign Keys**: All relationships must have foreign keys
- **NOT NULL**: Critical columns must be NOT NULL
- **CHECK**: Business rules enforced via CHECK constraints

#### Financial Constraints
- **Amounts**: Must be positive (> 0) for monetary values
- **Percentages**: Must be between 0 and 100
- **Dates**: Valid date ranges
- **References**: Valid foreign key references

#### Constraint Validation
- **Migration**: Add constraints as NOT VALID initially
- **Audit**: Clean existing data before validation
- **Validate**: Run VALIDATE CONSTRAINT migration
- **Monitor**: Alert on constraint violations

### Data Validation

#### Validation Rules
- **Email**: Valid email format
- **Phone**: Valid phone number format
- **UUID**: Valid UUID format
- **Dates**: Valid date ranges
- **Business**: Business-specific validation rules

#### Validation Procedures
- **Application**: Validate at application layer
- **Database**: Validate at database layer
- **Migration**: Validate during data migration
- **Audit**: Regular data quality audits

### Data Quality

#### Quality Metrics
- **Completeness**: Required fields populated
- **Accuracy**: Data matches real-world values
- **Consistency**: Data consistent across tables
- **Timeliness**: Data updated within SLA

#### Quality Monitoring
- **Daily**: Automated data quality checks
- **Weekly**: Manual data quality review
- **Monthly**: Comprehensive data quality report
- **Quarterly**: Data quality improvement initiatives

---

## Backup and Recovery

### Backup Strategy

#### Backup Types
- **Full**: Weekly full database backup
- **Incremental**: Daily incremental backups
- **Transaction Log**: Continuous transaction log backup
- **Pre-Migration**: Backup before each migration

#### Backup Retention
- **Daily**: 7 days
- **Weekly**: 4 weeks
- **Monthly**: 12 months
- **Pre-Migration**: 6 months

#### Backup Storage
- **Primary**: Supabase backup system
- **Secondary**: Geographic replication
- **Tertiary**: Cold storage for long-term retention
- **Encryption**: All backups encrypted at rest

### Recovery Procedures

#### Recovery Time Objectives
- **RPO**: 15 minutes (Recovery Point Objective)
- **RTO**: 1 hour (Recovery Time Objective)
- **Critical**: 15 minutes for critical systems
- **Non-Critical**: 4 hours for non-critical systems

#### Recovery Testing
- **Monthly**: Test restore from recent backup
- **Quarterly**: Test disaster recovery scenario
- **Annually**: Full disaster recovery drill
- **Documentation**: Update recovery procedures based on test results

### Disaster Recovery

#### Disaster Scenarios
- **Database Corruption**: Restore from backup
- **Data Center Outage**: Failover to secondary region
- **Accidental Data Deletion**: Point-in-time recovery
- **Security Breach**: Isolate and restore from clean backup

#### Recovery Team
- **Primary**: Database administrator
- **Secondary**: DevOps engineer
- **Support**: Application team
- **Communication**: Management team

---

## Performance Management

### Performance Monitoring

#### Key Metrics
- **Query Performance**: Query execution time
- **Connection Pool**: Connection utilization
- **Database Size**: Storage utilization
- **Index Usage**: Index hit rates
- **Lock Contention**: Lock wait times

#### Monitoring Tools
- **Supabase Dashboard**: Built-in monitoring
- **Custom Metrics**: Application-level metrics
- **Alerting**: Performance threshold alerts
- **Reporting**: Weekly performance reports

#### Performance Targets
- **Query Latency**: < 100ms for 95th percentile
- **Connection Pool**: < 80% utilization
- **Index Hit Rate**: > 95%
- **Lock Contention**: < 5% of queries

### Performance Optimization

#### Optimization Strategies
- **Indexing**: Add indexes for slow queries
- **Query Optimization**: Rewrite inefficient queries
- **Connection Pooling**: Optimize pool size
- **Caching**: Implement query caching
- **Partitioning**: Partition large tables

#### Optimization Process
1. Identify performance issues
2. Analyze root cause
3. Implement optimization
4. Test in staging
5. Deploy to production
6. Monitor results
7. Document changes

---

## Compliance and Auditing

### Regulatory Compliance

#### GDPR Compliance
- **Data Minimization**: Collect only necessary data
- **Right to be Forgotten**: Support data deletion requests
- **Data Portability**: Support data export requests
- **Consent Management**: Track user consent
- **Breach Notification**: 72-hour breach notification

#### PCI DSS Compliance
- **Payment Data**: Encrypt payment card data
- **Access Control**: Restrict payment data access
- **Audit Logging**: Log all payment data access
- **Network Security**: Secure data transmission
- **Vulnerability Management**: Regular security scans

### Audit Logging

#### Audit Events
- **Authentication**: Login, logout, password changes
- **Authorization**: Permission changes, role assignments
- **Data Access**: Access to sensitive data
- **Data Modifications**: Create, update, delete operations
- **Schema Changes**: Migration executions

#### Audit Retention
- **Authentication**: 2 years
- **Authorization**: 3 years
- **Data Access**: 1 year
- **Data Modifications**: 7 years
- **Schema Changes**: Permanent

#### Audit Review
- **Weekly**: Automated audit log review
- **Monthly**: Manual audit log review
- **Quarterly**: Comprehensive audit report
- **Annually**: External audit

---

## Change Management

### Change Request Process

#### Change Request Template
```markdown
## Change Request

**Title**: [Change Title]
**Type**: [Schema/Data/Security/Performance]
**Risk Level**: [LOW/MEDIUM/HIGH]
**Priority**: [LOW/MEDIUM/HIGH/CRITICAL]

### Description
[Detailed description of change]

### Justification
[Business justification for change]

### Impact Analysis
- **Affected Tables**: [List]
- **Data Impact**: [Description]
- **Performance Impact**: [Description]
- **Security Impact**: [Description]

### Rollback Plan
[Rollback procedure]

### Testing Plan
[Testing approach]

### Approval
- [ ] Developer
- [ ] DBA
- [ ] Security
- [ ] Management
```

#### Change Approval Workflow
1. **Submit**: Developer submits change request
2. **Review**: Technical review by DBA
3. **Security Review**: Security team review
4. **Approval**: Management approval
5. **Schedule**: Schedule deployment window
6. **Deploy**: Execute change
7. **Verify**: Verify change success
8. **Document**: Document change results

### Change Freeze Periods

#### Freeze Periods
- **Black Friday**: November 15 - December 31
- **Month-End**: Last 3 days of each month
- **Major Releases**: 1 week before major release
- **Emergency**: Emergency changes require CTO approval

#### Freeze Exceptions
- **Critical Security**: Immediate deployment
- **Data Corruption**: Immediate deployment
- **Legal Requirement**: As required
- **Customer Impact**: As needed

---

## Documentation

### Documentation Requirements

#### Migration Documentation
- **Purpose**: Clear description of migration purpose
- **Changes**: Detailed list of changes
- **Impact**: Assessment of impact
- **Rollback**: Rollback procedure
- **Testing**: Testing approach
- **Approval**: Approval record

#### Schema Documentation
- **Tables**: All tables documented
- **Columns**: All columns documented
- **Relationships**: All relationships documented
- **Constraints**: All constraints documented
- **Indexes**: All indexes documented

#### Procedure Documentation
- **Backup**: Backup procedures documented
- **Recovery**: Recovery procedures documented
- **Monitoring**: Monitoring procedures documented
- **Incident**: Incident procedures documented

### Documentation Updates

#### Update Frequency
- **Schema**: After each schema change
- **Procedures**: Quarterly or after major changes
- **Policies**: Annually or as needed
- **Training**: As needed

#### Documentation Review
- **Monthly**: Documentation accuracy review
- **Quarterly**: Documentation completeness review
- **Annually**: Documentation effectiveness review

---

## Training and Knowledge Sharing

### Training Requirements

#### Database Team
- **New Hires**: 2-week onboarding program
- **Existing Staff**: Quarterly training updates
- **Certifications**: Encourage relevant certifications
- **Conferences**: Attend relevant conferences

#### Development Team
- **Migration Development**: Migration development training
- **Performance**: Database performance training
- **Security**: Database security training
- **Best Practices**: Database best practices training

### Knowledge Sharing

#### Internal Sharing
- **Weekly**: Database team knowledge sharing
- **Monthly**: Cross-team knowledge sharing
- **Quarterly**: All-hands knowledge sharing
- **Ad-Hoc**: As needed for specific topics

#### External Knowledge
- **Conferences**: Attend database conferences
- **Publications**: Read industry publications
- **Community**: Participate in database communities
- **Standards**: Follow industry standards

---

## Incident Management

### Incident Classification

#### Severity Levels
- **P1 - Critical**: System down, data loss
- **P2 - High**: Major degradation, data corruption
- **P3 - Medium**: Minor degradation, performance issues
- **P4 - Low**: Cosmetic issues, documentation

#### Response Times
- **P1**: 15 minutes
- **P2**: 1 hour
- **P3**: 4 hours
- **P4**: 24 hours

### Incident Response

#### Response Process
1. **Detection**: Automated monitoring or user report
2. **Classification**: Determine severity level
3. **Notification**: Notify appropriate team
4. **Mitigation**: Implement immediate fix
5. **Resolution**: Complete fix
6. **Verification**: Verify fix effectiveness
7. **Documentation**: Document incident
8. **Post-Mortem**: Conduct post-mortem review

#### Escalation Path
- **Level 1**: On-call engineer
- **Level 2**: Team lead
- **Level 3**: Engineering manager
- **Level 4**: CTO/VP Engineering

---

## Governance Metrics

### Key Performance Indicators

#### Migration Metrics
- **Migration Success Rate**: > 95%
- **Migration Rollback Rate**: < 5%
- **Migration Time**: < 30 minutes average
- **Migration Testing Coverage**: 100%

#### Data Quality Metrics
- **Data Accuracy**: > 99%
- **Data Completeness**: > 95%
- **Data Consistency**: > 99%
- **Data Timeliness**: > 95%

#### Performance Metrics
- **Query Performance**: < 100ms 95th percentile
- **Database Availability**: > 99.9%
- **Backup Success Rate**: 100%
- **Recovery Time**: < 1 hour

#### Security Metrics
- **Security Incidents**: 0 critical incidents
- **Audit Log Coverage**: 100%
- **Access Control Compliance**: 100%
- **Data Encryption**: 100%

### Reporting

#### Regular Reports
- **Weekly**: Migration and performance report
- **Monthly**: Data quality and security report
- **Quarterly**: Comprehensive governance report
- **Annually**: Governance review and planning

#### Ad-Hoc Reports
- **Incident Reports**: After each incident
- **Change Reports**: After major changes
- **Audit Reports**: After audits
- **Compliance Reports**: As required

---

## Governance Committee

### Committee Structure

#### Members
- **Chair**: CTO
- **Database Lead**: Database administrator
- **Security Lead**: Security engineer
- **DevOps Lead**: DevOps engineer
- **Application Lead**: Application architect
- **Compliance Officer**: Compliance manager

#### Responsibilities
- **Policy Approval**: Approve governance policies
- **Change Approval**: Approve major changes
- **Incident Review**: Review major incidents
- **Compliance**: Ensure regulatory compliance
- **Strategy**: Database strategy and planning

#### Meeting Schedule
- **Weekly**: Operational review
- **Monthly**: Strategic review
- **Quarterly**: Comprehensive review
- **Ad-Hoc**: As needed

---

## Continuous Improvement

### Improvement Process

#### Feedback Collection
- **Stakeholder Feedback**: Regular stakeholder surveys
- **Team Feedback**: Team feedback sessions
- **User Feedback**: User satisfaction surveys
- **System Feedback**: System metrics analysis

#### Improvement Implementation
- **Identify**: Identify improvement opportunities
- **Prioritize**: Prioritize improvements
- **Plan**: Plan implementation
- **Execute**: Execute improvements
- **Measure**: Measure results
- **Iterate**: Continue improvement cycle

### Innovation

#### Technology Monitoring
- **New Technologies**: Monitor new database technologies
- **Best Practices**: Monitor industry best practices
- **Standards**: Monitor industry standards
- **Tools**: Evaluate new tools and technologies

#### Innovation Initiatives
- **Pilot Projects**: Test new technologies
- **Proof of Concepts**: Validate new approaches
- **Research**: Conduct research projects
- **Implementation**: Implement successful innovations

---

## Contact Information

### Governance Contacts
- **Database Team**: database@calqulusrms.com
- **Security Team**: security@calqulusrms.com
- **DevOps Team**: devops@calqulusrms.com
- **Compliance**: compliance@calqulusrms.com

### Emergency Contacts
- **On-Call DBA**: [Phone Number]
- **CTO**: [Phone Number]
- **Incident Commander**: [Phone Number]

### External Contacts
- **Supabase Support**: support@supabase.io
- **Security Consultant**: [Contact]
- **Compliance Consultant**: [Contact]

---

## Document Control

### Version History
- **Version 1.0**: Initial document creation (June 20, 2026)
- **Version 1.1**: [Future updates]

### Review Schedule
- **Next Review**: September 20, 2026
- **Review Cycle**: Quarterly

### Approval
- **Approved By**: [Name]
- **Approval Date**: June 20, 2026
- **Next Review**: September 20, 2026
