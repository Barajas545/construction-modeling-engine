
# DCR Product Lab

# Construction Modeling Engine (CME)

# Development Workflow

Version 1.0

Status: Approved

Owner: DCR Product Lab

---

# Purpose

This document defines the official collaboration workflow between Product Lab and Codex during the development of the Construction Modeling Engine (CME).

Its objective is to clearly separate product decisions from implementation decisions.

This workflow should remain valid throughout the lifetime of the project.

---

# Team Structure

The CME is developed by two independent teams with complementary responsibilities.

## Product Lab

Responsible for:

• Product vision

• Construction logic

• Business rules

• User experience

• Construction workflows

• Estimating philosophy

• Acceptance criteria

Product Lab defines WHAT the software should do.

Product Lab never writes production code.

---

## Codex

Responsible for:

• Software architecture

• Implementation

• Repository organization

• Refactoring

• Performance

• Automated testing

• Documentation

Codex decides HOW the software is implemented.

Codex must never define business rules without Product Lab approval.

---

# Core Principle

Business decisions belong to Product Lab.

Technical decisions belong to Codex.

Both teams collaborate toward the same product vision.

---

# Development Strategy

The Construction Modeling Engine will be developed as a single evolving application.

Prototype applications should not be created.

Every approved construction object becomes part of the CME immediately.

There is only one official CME.

---

# Tool Development Workflow

Every construction object follows the same lifecycle.

Product Specification

↓

Implementation

↓

Internal Testing

↓

Product Review

↓

Revision (if required)

↓

Approval

↓

Frozen

↓

Next Construction Object

Only one construction object should be actively developed at a time unless Product Lab explicitly approves parallel development.

---

# Construction Objects

The CME is composed of intelligent construction objects.

Each object represents a real-world construction component.

Examples include:

Deck Boundary

House Attachment

Stairs

Railings

Fascia

Picture Frame

Beams

Posts

Footings

Joist Groups

Construction Notes

Demolition

Future objects will follow the same philosophy.

---

# Repository Ownership

Product Lab owns:

specs/

Codex owns:

src/

docs/

tests/

Both teams collaborate on:

examples/

Assets may eventually receive contributions from Art Studio.

---

# Specifications

Product specifications are considered the official source of product behavior.

Codex should implement specifications exactly as approved.

If implementation ambiguities exist, Codex should pause implementation and request clarification instead of making business assumptions.

---

# Technical Decisions

Codex is encouraged to make independent decisions regarding:

Architecture

Folder organization

Performance

Rendering

Geometry

Internal APIs

Undo / Redo

Serialization

Testing

Whenever those decisions do not alter Product Lab behavior.

---

# Product Decisions

Only Product Lab may define:

Construction workflows

Estimating logic

Construction rules

User interaction philosophy

Construction relationships

Acceptance criteria

Long-term product vision

---

# Documentation Philosophy

Product specifications describe product behavior.

Technical documentation describes implementation.

These documents intentionally remain separate.

---

# Review Philosophy

Product Lab evaluates:

Construction accuracy

Business behavior

User workflow

Visual communication

Codex evaluates:

Maintainability

Architecture

Performance

Scalability

Testing

---

# Golden Rule

Whenever implementation conflicts with the product specification:

The implementation should change.

The specification should not change unless Product Lab explicitly approves the change.

---

# Long-Term Vision

The Construction Modeling Engine will eventually become the official Step 1 inside DCR Sales Hub.

Until then it will remain an independent application.

Its purpose is to digitally model how DCR constructs projects while preserving construction knowledge for future estimating.

---

# Official Motto

The field teaches.

Product Lab learns.

The Construction Modeling Engine remembers.
