# Example 3: Technical Project (B.R.O.K.E Framework)

## Original Prompt

```
I need to design a user authentication system
```

## Enhanced Prompt

```
Background: We're building a web application that requires secure user authentication. The application will handle user accounts, profile management, and need to support both email/password and social login (Google, GitHub). We're using Node.js with Express for the backend and expect to have both web and mobile clients.

Role: You are a senior backend architect and security specialist with 8+ years of experience designing authentication systems for production applications.

Objectives:
1. Design a secure, scalable authentication architecture
2. Define the database schema for users and authentication
3. Specify API endpoints for auth operations
4. Address security best practices and common vulnerabilities
5. Plan for session management and token handling

Key Results:
- Complete system architecture diagram showing authentication flow
- Database schema with tables for users, sessions, and OAuth connections
- RESTful API specification with endpoints for:
  * User registration and email verification
  * Login (credential-based and OAuth)
  * Password reset flow
  * Token refresh and logout
- Security recommendations including:
  * Password hashing (bcrypt/argon2)
  * JWT token structure and validation
  * CSRF protection
  * Rate limiting strategies
  * Secure session management
- Implementation roadmap with phases

Evolve:
- Phase 1: Basic email/password authentication
- Phase 2: OAuth integration
- Phase 3: Multi-factor authentication
- Phase 4: Advanced security features (device management, anomaly detection)

Consider future enhancements like single sign-on (SSO) and enterprise features.
```

## Analysis

**Task Type**: Technical project / System design
**Framework Selected**: B.R.O.K.E (Background - Role - Objectives - Key Results - Evolve)
**Rationale**: Technical projects benefit from comprehensive context, clear deliverables, and phased evolution

**Improvements Made**:
- Background: Added tech stack and requirements context
- Role: Established expert security architect persona
- Objectives: Listed specific goals (5 items)
- Key Results: Defined concrete deliverables (architecture, schema, API, security, roadmap)
- Evolve: Outlined phased implementation approach
- Considered scalability and future enhancements
