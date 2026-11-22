# FitVibe Documentation Hub

This workspace is the **single source of truth** for product requirements, technical design, testing strategy, and decision records that govern FitVibe V2.

## Purpose

The documentation hub serves as the authoritative reference for:

- **Product Requirements**: Business goals, user journeys, and feature specifications
- **Technical Design**: System architecture, data flows, and integration plans
- **Testing Strategy**: Quality gates, test plans, and release criteria
- **Architecture Decisions**: Recorded technical decisions and their rationale
- **Design System**: Personas, visual design, and user flows
- **Policies**: Security, privacy, legal, and operational governance

## Documentation Structure

### Core Documents

| Document                                | Path                                                                             | Purpose                                                |
| --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Glossary**                            | [`0.Glossary.md`](0.Glossary.md)                                                 | Terminology and acronyms used throughout the project   |
| **Product Requirements Document (PRD)** | [`1.Product_Requirements/`](1.Product_Requirements/)                             | Business goals, user journeys, and feature scope       |
| **Technical Design Document (TDD)**     | [`2.Technical_Design_Document/`](2.Technical_Design_Document/)                   | System architecture, data flows, and integration plans |
| **Design System**                       | [`3.Sensory_Design_System/`](3.Sensory_Design_System/)                           | Personas, visual design, and user flow documentation   |
| **Testing & QA Plan**                   | [`4.Testing_and_Quality_Assurance_Plan/`](4.Testing_and_Quality_Assurance_Plan/) | Test strategy, quality gates, and release criteria     |
| **Policies**                            | [`5.Policies/`](5.Policies/)                                                     | Security, privacy, legal, and operational policies     |

### Key Subdirectories

#### Product Requirements (`1.Product_Requirements/`)

- [`1.Product_Requirements_Document.md`](1.Product_Requirements/1.Product_Requirements_Document.md) - Main PRD
- `AC_Master.md` - Acceptance Criteria master list
- `Requirements/` - Detailed requirement specifications
- `rtm_comprehensive.csv` - Requirements Traceability Matrix

#### Technical Design (`2.Technical_Design_Document/`)

**Main Documents:**

- [`2a.Technical_Design_Document_TechStack.md`](2.Technical_Design_Document/2a.Technical_Design_Document_TechStack.md) - Technology stack decisions
- [`2b.Technical_Design_Document_Modules.md`](2.Technical_Design_Document/2b.Technical_Design_Document_Modules.md) - Module architecture
- [`2c.Technical_Design_Document_Data.md`](2.Technical_Design_Document/2c.Technical_Design_Document_Data.md) - Data model and database design
- [`2d.Technical_Design_Document_APIDesign.md`](2.Technical_Design_Document/2d.Technical_Design_Document_APIDesign.md) - API design and contracts
- [`2e.Technical_Design_Document_misc.md`](2.Technical_Design_Document/2e.Technical_Design_Document_misc.md) - Miscellaneous technical details
- [`CODING_STYLE_GUIDE.md`](2.Technical_Design_Document/CODING_STYLE_GUIDE.md) - **Coding style guide for React and Express**
- [`FRONTEND_AUTHENTICATED_STARTUP.md`](2.Technical_Design_Document/FRONTEND_AUTHENTICATED_STARTUP.md) - Authenticated startup path, measured results and security invariants (#634)

**Supporting Materials:**

- [`2.f.Architectural_Decision_Documentation/`](2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/) - Architecture Decision Records (ADRs)
- [`2.g.Diagrams/`](2.Technical_Design_Document/2.g.Diagrams/) - Mermaid diagrams and visual documentation
- [`project-structure.md`](2.Technical_Design_Document/project-structure.md) - Canonical filesystem blueprint
- [`INFRASTRUCTURE.md`](2.Technical_Design_Document/INFRASTRUCTURE.md) - Infrastructure and deployment documentation
- [`API_Reference_Generation.md`](2.Technical_Design_Document/API_Reference_Generation.md) - API documentation generation guide
- [`SMTP_Setup_Guide.md`](2.Technical_Design_Document/SMTP_Setup_Guide.md) - Email service configuration

#### Architecture Decision Records

Located in [`2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/`](2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/):

- [`ADR_INDEX.md`](2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR_INDEX.md) - Index of all ADRs
- [`ADR_TEMPLATE.md`](2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR_TEMPLATE.md) - Template for creating new ADRs
- Individual ADRs covering topics such as:
  - API versioning (ADR-001)
  - Authentication token strategy (ADR-002)
  - Data retention and GDPR (ADR-003)
  - Media upload safety (ADR-004)
  - Monorepo structure (ADR-012)
  - Technology stack (ADR-014)
  - And more...

#### Design System (`3.Sensory_Design_System/`)

- [`3.a.Personas/`](3.Sensory_Design_System/3.a.Personas/) - User personas and profiles
- [`3.b.Visual Design System.md`](3.Sensory_Design_System/3.b.Visual%20Design%20System.md) - Visual design guidelines
- [`3.c.User_Flow_Documentation.md`](3.Sensory_Design_System/3.c.User_Flow_Documentation.md) - User journey and flow documentation

#### Testing & QA (`4.Testing_and_Quality_Assurance_Plan/`)

- [`4a.Testing_and_Quality_Assurance_Plan.md`](4.Testing_and_Quality_Assurance_Plan/4a.Testing_and_Quality_Assurance_Plan.md) - Main testing strategy document
- `4b.Testing_and_Quality_Assurance_Plan_ApB.md` - Appendix B
- `4c.Testing_and_Quality_Assurance_Plan_ApCD.md` - Appendices C & D
- `4d.Testing_and_Quality_Assurance_Plan_ApEF.md` - Appendices E & F

#### Policies (`5.Policies/`)

- [`Privacy_Policy.md`](5.Policies/Privacy_Policy.md) - Privacy policy and GDPR compliance
- [`terms-and-conditions.md`](5.Policies/terms-and-conditions.md) - Terms of service
- [`Cookie-policy.md`](5.Policies/Cookie-policy.md) - Cookie usage policy
- [`Legal-order.md`](5.Policies/Legal-order.md) - Legal ordering information
- [`Data_Map.md`](5.Policies/Data_Map.md) - Data mapping and classification
- [`5.a.Ops/`](5.Policies/5.a.Ops/) - Operational policies
- [`5.b.Security/`](5.Policies/5.b.Security/) - Security policies and procedures

#### Implementation (`Implementation/`)

**Note**: This folder contains project planning, implementation reports, and review documents. These files are excluded from version control (see `.gitignore`).

- `PROJECT_EPICS_AND_ACTIVITIES.md` - Epic definitions and activity breakdowns
- `GITHUB_ISSUES_SETUP.md` - GitHub issues setup and tracking
- `WCAG_2.2_IMPLEMENTATION_PLAN.md` - WCAG 2.2 compliance implementation plan
- `WCAG_2.2_UPDATE_PLAN.md` - WCAG 2.2 update planning
- `Bug_Fixer_*.md` - Bug fixing agent reports and reviews

## Working With the Documentation

### Document Maintenance

- **Keep numbered documents in sync**: The numbering matches cross-references throughout the codebase
- **Update immediately**: Reflect structural changes from the codebase in `project-structure.md` to avoid drift
- **Version control**: Treat documentation like source code - review changes, keep commit history descriptive

### Creating New Documentation

#### Architecture Decision Records

1. Use [`ADR_TEMPLATE.md`](2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR_TEMPLATE.md) as a starting point
2. Follow the naming convention: `ADR-XXX-descriptive-name.md`
3. Add the new ADR to [`ADR_INDEX.md`](2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR_INDEX.md)
4. Link the ADR from relevant sections in the PRD or TDD

#### Diagrams

1. Place diagrams in [`2.g.Diagrams/`](2.Technical_Design_Document/2.g.Diagrams/)
2. Use Mermaid format (`.mmd`) for version-controlled diagrams
3. Follow naming convention: `<source>_<section>_<slug>.mmd`
   - Example: `prd-6-1-high-level-architecture.mmd`
4. Update [`diagrams_index.md`](2.Technical_Design_Document/2.g.Diagrams/diagrams_index.md) when adding new diagrams

#### Policies

1. Policies should live under [`5.Policies/`](5.Policies/) for independent consumption by infra and security teams
2. Update relevant policy documents when making changes that affect security, privacy, or compliance

### Contribution Guidelines

1. **Prefer Markdown**: Use Markdown with fenced code blocks for technical snippets
2. **Link extensively**: Embed links to relevant code locations, ADRs, or other documentation to keep readers oriented
3. **Align terminology**: Use terminology consistent with the [Glossary](0.Glossary.md) and product language
4. **Cross-reference**: When updating one document, check if related documents need updates too

### Reading Guide by Role

- **Engineers**: Start with the [TDD](2.Technical_Design_Document/) and relevant ADRs; implement according to specs, contracts, and runbooks
- **QA**: Use the [Testing & QA Plan](4.Testing_and_Quality_Assurance_Plan/) and RTM links to derive tests and quality gates
- **Security/Compliance**: Review [Policies](5.Policies/), verify controls, data classification, and GDPR flows
- **Product/Design**: Confirm behavior matches [PRD](1.Product_Requirements/) intent; reference [Design System](3.Sensory_Design_System/) for UX guidelines

## Quick Links

- [Main README](../README.md) - Project overview and quick start
- [Contributing Guide](CONTRIBUTING.md) - How to contribute to the project
- [Glossary](0.Glossary.md) - Terminology reference
- [ADR Index](2.Technical_Design_Document/2.f.Architectural_Decision_Documentation/ADR_INDEX.md) - All architecture decisions
- [Diagrams Index](2.Technical_Design_Document/2.g.Diagrams/diagrams_index.md) - Visual documentation

---

**Note**: This documentation hub is maintained alongside the codebase. When making changes to features, architecture, or processes, update the relevant documentation to keep it current and accurate.
