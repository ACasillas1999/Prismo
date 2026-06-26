-- ============================================================================
-- PRISMO — Sistema de Evaluación de KPIs
-- Database Schema
-- ============================================================================

CREATE DATABASE IF NOT EXISTS prismo_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE prismo_db;

-- ── Departamentos ───────────────────────────────────────────────────────────
CREATE TABLE departments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active   TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── Puestos ─────────────────────────────────────────────────────────────────
CREATE TABLE positions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  department_id INT NOT NULL,
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE KEY uq_position_dept (department_id, name)
) ENGINE=InnoDB;

-- ── Usuarios / Agentes ──────────────────────────────────────────────────────
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  role          ENUM('admin','department_head','agent') NOT NULL DEFAULT 'agent',
  department_id INT NULL,
  position_id   INT NULL,
  avatar_url    VARCHAR(500) NULL,
  is_active     TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (position_id)   REFERENCES positions(id)   ON DELETE SET NULL,

  INDEX idx_users_role (role),
  INDEX idx_users_dept (department_id)
) ENGINE=InnoDB;

-- ── Plantillas de Evaluación ────────────────────────────────────────────────
CREATE TABLE evaluation_templates (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  position_id INT NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  is_active   TINYINT(1) DEFAULT 1,
  is_draft    TINYINT(1) DEFAULT 0,
  created_by  INT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by)  REFERENCES users(id),

  INDEX idx_templates_position (position_id)
) ENGINE=InnoDB;

-- ── Categorías de Plantilla ─────────────────────────────────────────────────
-- La suma de `weight` de todas las categorías de una plantilla DEBE ser 100.
CREATE TABLE template_categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  weight      DECIMAL(5,2) NOT NULL COMMENT 'Peso porcentual, ej: 35.00',
  sort_order  INT DEFAULT 0,
  is_active   TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (template_id) REFERENCES evaluation_templates(id) ON DELETE CASCADE,

  INDEX idx_categories_template (template_id)
) ENGINE=InnoDB;

-- ── Criterios de Plantilla ──────────────────────────────────────────────────
-- Cada criterio tiene peso relativo dentro de su categoría (suman 100 por categoría).
-- type = 'measurable': el agente reporta agent_value vs target_value
-- type = 'subjective': el jefe califica directamente (0-100)
CREATE TABLE template_criteria (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  category_id  INT NOT NULL,
  name         VARCHAR(200) NOT NULL,
  description  TEXT COMMENT 'Instrucciones de evaluación',
  type         ENUM('measurable','subjective') NOT NULL DEFAULT 'subjective',
  target_value DECIMAL(10,2) NULL COMMENT 'Meta numérica (solo measurable)',
  unit         VARCHAR(50)  NULL COMMENT 'Unidad: proyectos, %, entregables, etc.',
  weight       DECIMAL(5,2) NOT NULL COMMENT 'Peso dentro de la categoría',
  cap_at_100   TINYINT(1) DEFAULT 1,
  rules        JSON NULL COMMENT 'Array de reglas [min, max, pct]',
  requires_evidence TINYINT(1) DEFAULT 0 COMMENT '¿Requiere el agente subir archivos de evidencia?',
  sort_order   INT DEFAULT 0,
  is_active    TINYINT(1) DEFAULT 1,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (category_id) REFERENCES template_categories(id) ON DELETE CASCADE,

  INDEX idx_criteria_category (category_id)
) ENGINE=InnoDB;

-- ── Períodos de Evaluación ──────────────────────────────────────────────────
CREATE TABLE evaluation_periods (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  status     ENUM('draft','active','closed') DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(id),

  INDEX idx_periods_status (status),
  INDEX idx_periods_dates (start_date, end_date)
) ENGINE=InnoDB;

-- ── Evaluaciones ────────────────────────────────────────────────────────────
-- Instancia de una evaluación: un agente + una plantilla + un período.
CREATE TABLE evaluations (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  user_id             INT NOT NULL COMMENT 'Agente evaluado',
  template_id         INT NOT NULL,
  period_id           INT NOT NULL,
  status              ENUM('pending','in_progress','submitted','reviewed','completed') DEFAULT 'pending',
  overall_score       DECIMAL(5,2) NULL COMMENT 'Puntaje final calculado (0-100)',
  evaluator_id        INT NULL COMMENT 'Jefe que evalúa',
  evaluator_comments  TEXT NULL,
  submitted_at        TIMESTAMP NULL COMMENT 'Cuando el agente envió su avance',
  reviewed_at         TIMESTAMP NULL COMMENT 'Cuando el jefe revisó',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES evaluation_templates(id),
  FOREIGN KEY (period_id)   REFERENCES evaluation_periods(id),
  FOREIGN KEY (evaluator_id) REFERENCES users(id),

  UNIQUE KEY uq_evaluation (user_id, template_id, period_id),
  INDEX idx_evaluations_period (period_id),
  INDEX idx_evaluations_status (status)
) ENGINE=InnoDB;

-- ── Calificaciones por Criterio ─────────────────────────────────────────────
CREATE TABLE evaluation_scores (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  evaluation_id    INT NOT NULL,
  criterion_id     INT NOT NULL,
  agent_value      DECIMAL(10,2) NULL COMMENT 'Valor reportado por el agente (measurable)',
  agent_comment    TEXT NULL,
  evaluator_score  DECIMAL(5,2)  NULL COMMENT 'Calificación del jefe (0-100)',
  evaluator_comment TEXT NULL,
  calculated_score DECIMAL(5,2)  NULL COMMENT 'Puntaje calculado final del criterio',
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id)  REFERENCES template_criteria(id) ON DELETE CASCADE,

  UNIQUE KEY uq_score (evaluation_id, criterion_id)
) ENGINE=InnoDB;

-- ── Evidencias de Evaluación ────────────────────────────────────────────────
CREATE TABLE evaluation_evidences (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  score_id         INT NOT NULL,
  file_name        VARCHAR(255) NOT NULL,
  file_url         VARCHAR(500) NOT NULL,
  uploaded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (score_id) REFERENCES evaluation_scores(id) ON DELETE CASCADE
) ENGINE=InnoDB;
