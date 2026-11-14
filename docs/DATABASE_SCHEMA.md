# LawPro Database Schema

## Entity Relationship Diagram

```
┌─────────────────┐
│      users      │
├─────────────────┤
│ id (PK)         │
│ email (unique)  │
│ password_hash   │
│ full_name       │
│ role            │  -- enum: advocate, clerk, admin
│ created_at      │
│ updated_at      │
└─────────────────┘
       │
       │ (owns cases)
       │
┌─────────────────┐
│      cases      │
├─────────────────┤
│ id (PK)         │
│ user_id (FK)    │  -- references users.id
│ title           │  -- varchar(255)
│ case_number     │  -- varchar(100)
│ court           │  -- varchar(150)
│ next_hearing    │  -- date
│ notes           │  -- text
│ is_overdue      │  -- boolean, computed
│ created_at      │
│ updated_at      │
└─────────────────┘

┌─────────────────┐
│  limitations    │  -- optional, advanced feature
├─────────────────┤
│ id (PK)         │
│ case_id (FK)    │  -- references cases.id
│ section_number  │  -- varchar(50)
│ start_date      │  -- date
│ deadline_date   │  -- date
│ created_at      │
└─────────────────┘
```

## Indexing Strategy

```sql
-- Primary keys (auto-indexed)
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_next_hearing ON cases(next_hearing);
CREATE INDEX idx_cases_court ON cases(court);
-- For efficient overdue queries
CREATE INDEX idx_cases_overdue ON cases(user_id, is_overdue);
```

## Table Definitions

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | User ID |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Login email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| full_name | VARCHAR(255) |  | User's name |
| role | VARCHAR(20) | DEFAULT 'advocate' | Role: advocate, clerk, admin |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

### cases

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PK | Case ID |
| user_id | INTEGER | FK → users.id, NOT NULL | Owner |
| title | VARCHAR(255) | NOT NULL | Case title |
| case_number | VARCHAR(100) | NOT NULL | Court case number |
| court | VARCHAR(150) | NOT NULL | Court name |
| next_hearing | DATE | NOT NULL | Next hearing date |
| notes | TEXT |  | Free-form notes |
| is_overdue | BOOLEAN | STORED GENERATED | Computed: next_hearing < today |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

## Sample Queries

### Get all cases for a user (sorted by hearing date)
```sql
SELECT * FROM cases
WHERE user_id = :user_id
ORDER BY next_hearing ASC;
```

### Get overdue cases
```sql
SELECT * FROM cases
WHERE user_id = :user_id
  AND next_hearing < CURRENT_DATE
ORDER BY next_hearing ASC;
```

### Count cases per court
```sql
SELECT court, COUNT(*) as case_count
FROM cases
GROUP BY court
ORDER BY case_count DESC;
```