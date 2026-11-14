# LawPro Next Steps

## Immediate Actions (Before Coding)

1. [ ] **Get GitHub repo permission** — Need to create `lawpro` repository
2. [ ] **Initialize Git** — In `D:\experiments ai\LawPro` directory
3. [ ] **Create initial commit** — Push docs to GitHub

## Phase 2 Start

Once Git is initialized and remote is connected:

1. **Backend Setup**
   - [ ] Create `backend/app/` directory structure
   - [ ] Create `backend/requirements.txt`
   - [ ] Implement `app/main.py` (FastAPI app)
   - [ ] Create `app/core/config.py` (settings)
   - [ ] Create `app/models/user.py` (SQLAlchemy)
   - [ ] Create `app/schemas/user.py` (Pydantic)
   - [ ] Create `app/api/v1/auth.py` (endpoints)
   - [ ] Set up Alembic migrations

2. **Frontend Setup**
   - [ ] Create `frontend/src/` structure
   - [ ] Initialize Tailwind CSS
   - [ ] Create basic page layout

3. **Integration**
   - [ ] Connect frontend to backend API
   - [ ] Test authentication flow
   - [ ] Deploy both to free tiers

## Questions to Resolve

1. Do we need court repository seeding? (Optional)
2. Should we support Google OAuth in addition to email/password? (Deferred)

## Ready for Implementation**

This project is ready to begin coding as soon as Git is initialized and pushed to GitHub.