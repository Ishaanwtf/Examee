# Examee

### AI-Assisted Examination Evaluation & On-Screen Marking

Examee is a web-based examination evaluation system designed around the way institutions actually handle handwritten answer sheets.

Instead of treating AI grading as a standalone feature, Examee places AI inside the complete examination workflow:

**Exam Cell → Centralized Answer-Sheet Repository → Teacher Assignment → AI Digitization → Marking-Scheme-Aware Evaluation → Examiner Review → Finalization**

The result is a structured, reviewable workflow for moving handwritten examination papers from physical scans to digitally assisted evaluation while keeping the final academic decision with the examiner.

---

## Why Examee?

Handwritten university examinations create a workflow problem that goes beyond marking individual answers.

An institution may need to:

- ingest large volumes of scanned answer sheets
- associate every paper with the correct examination, program, semester, subject, and student
- route papers to the correct evaluator
- digitize handwritten responses
- evaluate answers using an examiner-defined marking scheme
- support step-wise marking for multi-step questions
- let teachers review and modify AI-generated results
- track the state of papers from processing through finalization

Examee is built around that workflow.

---

## Core Idea

> **Examee is designed as an examination system with AI inside it, not an AI model with an examination interface around it.**

The architecture separates institutional examination operations from AI processing and human academic judgment.

### Institutional workflow

```text
┌────────────────────┐
│      Exam Cell     │
│ Upload + Metadata  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Central Repository │
│ Identity + Status  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Teacher Assignment │
│ Role-filtered Queue│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ AI Digitization    │
│ Vision / OCR       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Marking Scheme     │
│ Questions + Steps  │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ AI Evaluation      │
│ Marks + Feedback   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Examiner Review    │
│ Accept / Override  │
│ Flag / Notes       │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Finalized Result   │
└────────────────────┘
```

---

## Key Features

### 1. Centralized Exam-Cell Ingestion

The Exam Cell acts as the central intake point for scanned answer sheets.

Each paper can be associated with academic metadata such as:

- Academic year
- Examination
- Major / program
- Semester
- Subject
- Course code
- Student roll number / ID
- Assigned teacher

This creates a structured examination record instead of treating a scan as an isolated file.

### 2. Role-Based Examination Workspaces

Examee separates institutional responsibilities.

**Exam Cell**

- Central answer-sheet ingestion
- Examination metadata
- Assignment
- Processing visibility
- Finalization visibility

**Teacher**

- Assigned answer-sheet queue
- Evaluation workflow
- Marking scheme
- AI-assisted grading
- Examiner review
- Teacher analytics

The teacher workspace is scoped to papers assigned to that evaluator.

### 3. AI Handwriting Digitization

Uploaded answer sheets can be processed through the application's AI vision/OCR pipeline.

The goal is to convert handwritten responses into structured information that can then be passed into the evaluation workflow.

### 4. Marking-Scheme-Aware Evaluation

Teachers can provide a question-wise marking scheme instead of relying only on generic subject knowledge.

A scheme can define:

- Maximum marks
- Question-specific criteria
- Step-wise marks
- Expected components of an answer
- Marks associated with intermediate steps

The grading pipeline receives this context when evaluating the extracted answer.

### 5. Step-Wise Marking

For multi-step problems, evaluation can consider individual steps rather than treating the answer as a single unexplained score.

This is particularly relevant to subjects such as Mathematics, Physics, Engineering, and other structured-answer examinations.

### 6. Human-in-the-Loop Review

AI output is presented as assistance, not as an irreversible academic decision.

The examiner can:

- review the extracted response
- inspect the AI-generated evaluation
- accept the suggested score
- override the score
- flag an answer for review
- add examiner notes
- finalize the evaluation

> **AI assists the examiner. The examiner remains the academic authority.**

### 7. Persistent Evaluation State

The current prototype maintains structured application records for:

- answer-sheet metadata
- OCR output
- extracted answers
- evaluation results
- examiner review state
- workflow status

The evaluation lifecycle includes states such as:

**Pending → Processing → AI Evaluated → Needs Review → Finalized**

---

## Application Areas

### Exam Cell Dashboard

The Exam Cell dashboard provides a centralized view of answer-sheet operations, including:

- total answer sheets
- processing papers
- assignment state
- finalized papers
- recent answer-sheet activity
- evaluation progress

### Answer Sheet Ingestion

The ingestion interface supports entering academic metadata and selecting the answer-sheet scan before processing.

### Teacher Dashboard

Teachers receive a focused work queue containing papers assigned to them.

### Marking Scheme

The teacher can enter or import a question-wise marking scheme that becomes evaluation context for the AI grading workflow.

### Evaluation

The evaluation workflow presents the processed answer and AI-generated grading information for examiner review and finalization.

### Analytics

The teacher workspace includes evaluation progress and workflow visibility for assigned papers.

---

## Technical Architecture

Examee is implemented as a modular Next.js application with separate application and AI processing paths.

### Stack

- **Next.js 14**
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Lucide React**
- **OpenAI-compatible Node SDK**
- **Gemini vision/OCR through the configured AI provider**
- **PDF-Lib**
- **Local JSON persistence for the current prototype**

The repository's package configuration currently uses Next.js 14.2.x, React 18, TypeScript 5.x, Tailwind CSS 3.x, `openai`, `pdf-lib`, and `lucide-react`.

### Important API Routes

#### `POST /api/process`

Handles answer-sheet processing and AI-assisted digitization/OCR.

High-level flow:

```text
Uploaded scan
     ↓
Server-side file handling
     ↓
Multimodal AI request
     ↓
OCR / extracted answer content
     ↓
Structured application record
```

#### `POST /api/grade`

Handles AI-assisted answer evaluation.

High-level flow:

```text
Extracted answer
      +
Marking scheme
      ↓
AI grading request
      ↓
Marks + evaluation + feedback
      ↓
Examiner review
```

---

## Data Flow

Examee separates the major concerns of the workflow:

```text
Examination Operations
        │
        ▼
Answer-Sheet Record
        │
        ├── Metadata
        ├── Assignment
        ├── Status
        ├── OCR Output
        ├── Extracted Answers
        └── Evaluation
                 │
                 ▼
          Examiner Review
                 │
                 ▼
             Finalized
```

This makes it possible to evolve the underlying infrastructure later without changing the core examination workflow.

---

## Repository Structure

The project is organized around the Next.js application, reusable UI components, API routes, and application logic.

```text
Examee/
├── app/
│   ├── api/
│   │   ├── process/
│   │   └── grade/
│   └── ...
├── components/
├── lib/
├── public/
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

The exact component structure may evolve as the prototype develops.

---

## Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/Ishaanwtf/Examee.git
cd Examee
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create `.env.local` from the example file:

```bash
cp .env.example .env.local
```

Set the required AI provider credentials.

Example:

```env
AICREDITS_API_KEY=your_key_here
OCR_MODEL=google/gemini-3.1-flash-lite
```

Do not commit real API keys to the repository.

### 4. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

### 5. Production build

```bash
npm run build
```

### 6. Start the production build

```bash
npm run start
```

---

## Demo Roles

The prototype includes role-based demo access for demonstrating the institutional workflow.

Available roles include:

- **Exam Cell**
- **Mathematics Teacher**
- **Physics Teacher**
- **CS Teacher**

The login interface provides the demo-role entry points used for the prototype demonstration.

No real institutional credentials are included in the repository.

---

## Prototype Scope

The current version intentionally focuses on the core examination evaluation loop:

**Ingestion → Assignment → Digitization → Marking Scheme → AI Evaluation → Review → Finalization**

The prototype is intended to demonstrate the workflow and technical approach rather than represent a fully deployed university examination platform.

### Current prototype characteristics

- local application persistence
- development-oriented file handling
- role-based demo accounts
- AI vision/OCR processing
- AI-assisted grading
- examiner review controls
- single-paper evaluation workflow
- teacher-side analytics and status visibility

---

## Production Roadmap

The current architecture is designed so the workflow can evolve toward institutional deployment.

Potential production additions include:

### Infrastructure

- managed relational database
- secure object storage
- background processing queues
- batch answer-sheet processing
- monitoring and observability
- automated backups
- retention policies

### Identity and Security

- university SSO
- institutional identity integration
- fine-grained permissions
- audit logging
- stronger data isolation
- secure document access controls

### AI Operations

- confidence-aware review queues
- anomaly detection
- handwriting-quality checks
- evaluation calibration
- model monitoring
- human feedback loops

### Institutional Analytics

- department-level evaluation progress
- examiner workload analytics
- turnaround-time reporting
- examination-level dashboards
- operational reporting

These are future extensions and are not presented as completed capabilities of the current prototype.

---

## Responsible AI Approach

Examee is built around a human-in-the-loop evaluation model.

The system is intended to reduce repetitive work and provide structured AI assistance while keeping the examiner responsible for the final academic decision.

The prototype therefore distinguishes between:

**AI output**

and

**final examiner decision**

This distinction is important for examination workflows where transparency, reviewability, and accountability matter.

---

## What Examee Demonstrates

Examee demonstrates that an AI-assisted marking system can be structured around the complete institutional workflow rather than only around the AI model.

The prototype connects:

**Centralized ingestion**

→ **Role-based assignment**

→ **Handwriting digitization**

→ **Marking-scheme-aware evaluation**

→ **Step-wise marking**

→ **Human review**

→ **Finalization**

The central idea is simple:

> **Centralize the papers. Assist the evaluation. Preserve examiner control.**

---

## Status

**Hackathon Prototype**

Built as a working proof of concept for AI-assisted examination evaluation and on-screen marking.

---

## License

This repository is currently intended for hackathon and demonstration purposes. Add an explicit open-source license before distributing the project for general reuse.

---

## Project

**Examee**

AI-Assisted Examination Evaluation & On-Screen Marking

Repository: https://github.com/Ishaanwtf/Examee
