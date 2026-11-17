# LawPro API Documentation

## Authentication

### Register User
**POST** `/api/v1/auth/register`

Register a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

**Response**: `201 Created`
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "advocate",
  "is_active": true
}
```

---

### Login
**POST** `/api/v1/auth/login`

Authenticate and receive JWT token.

**Request Body** (form-data):
```
username=user@example.com
password=password123
```

**Response**: `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### Get Current User
**GET** `/api/v1/auth/me`

Get authenticated user information.

**Headers**:
```
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "advocate",
  "is_active": true
}
```

---

## Case Management

All case endpoints require authentication.

### Create Case
**POST** `/api/v1/cases`

Create a new case.

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "case_title": "Contract Dispute",
  "case_number": "CD-2024-001",
  "court_name": "Supreme Court",
  "client_name": "ABC Corp",
  "case_type": "civil",
  "description": "Contract breach case",
  "filing_date": "2024-01-15",
  "next_hearing_date": "2024-02-20",
  "status": "pending"
}
```

**Response**: `201 Created`

---

### List Cases
**GET** `/api/v1/cases`

List all cases for the authenticated user.

**Headers**:
```
Authorization: Bearer <token>
```

**Response**: `200 OK`
```json
[
  {
    "id": 1,
    "user_id": 1,
    "case_title": "Contract Dispute",
    "case_number": "CD-2024-001",
    "court_name": "Supreme Court",
    "client_name": "ABC Corp",
    "case_type": "civil",
    "description": "Contract breach case",
    "filing_date": "2024-01-15",
    "next_hearing_date": "2024-02-20",
    "status": "pending",
    "created_at": "2024-01-15T00:00:00Z",
    "updated_at": "2024-01-15T00:00:00Z"
  }
]
```

---

### Get Single Case
**GET** `/api/v1/cases/{case_id}`

Get a specific case.

**Response**: `200 OK` or `404 Not Found`

---

### Update Case
**PUT** `/api/v1/cases/{case_id}`

Update a case.

**Request Body**:
```json
{
  "status": "ongoing",
  "notes": "Updated status"
}
```

---

### Delete Case
**DELETE** `/api/v1/cases/{case_id}`

Delete a case.

**Response**: `204 No Content`

---

### Get Dashboard Statistics
**GET** `/api/v1/cases/dashboard`

Get case statistics for the authenticated user.

**Response**: `200 OK`
```json
{
  "total_cases": 10,
  "pending_cases": 3,
  "ongoing_cases": 5,
  "completed_cases": 2,
  "upcoming_hearings": 1
}
```

## Error Responses

### 401 Unauthorized
Returned when authentication is missing or invalid.
```json
{
  "detail": "Could not validate credentials"
}
```

### 403 Forbidden
Returned when user doesn't have permission to access a resource.

### 404 Not Found
Returned when a resource doesn't exist.
```json
{
  "detail": "Case not found"
}
```

### 422 Unprocessable Entity
Returned when request validation fails.
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "value is not a valid email address",
      "type": "value_error.email"
    }
  ]
}
```

### 500 Internal Server Error
Returned on server errors.

## Frontend Integration

Use the API client from `/lib/api.ts`:

```typescript
import { login, createCase, getCases } from '@/lib/api';

// Login
const { access_token } = await login({ email, password });
localStorage.setItem('token', access_token);

// Create case
const newCase = await createCase({ 
  case_title: 'My Case',
  next_hearing_date: '2024-02-20'
});
```

## JWT Token Structure

```json
{
  "sub": "1",
  "email": "user@example.com",
  "role": "advocate",
  "exp": 1705459200
}
```

Access tokens are signed with HS256 and expire after 30 minutes.
