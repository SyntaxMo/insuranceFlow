---
version: alpha
name: InsureFlow
description: An English-language motor insurance portfolio demonstration with restrained account and staff workspaces.
colors:
  primary: "#0f766e"
  primary-deep: "#0b5f59"
  navy: "#0b2a4a"
  navy-deep: "#071e36"
  teal-soft: "#e6f4f2"
  mist: "#dbe7f3"
  background: "#f3f6f9"
  foreground: "#0f172a"
typography:
  sans:
    fontFamily: "Inter, Helvetica Neue, Helvetica, Arial, sans-serif"
rounded:
  control: "0.75rem"
  dialog: "1rem"
spacing:
  account-page-max: "64rem"
  control-min-height: "2.5rem"
components:
  button: {}
  field: {}
  card: {}
  dialog: {}
---

# InsureFlow design context

## Overview

This records the existing application, not a rebrand. The reference is a restrained
insurance service desk: readable account details, contextual workflow evidence and
clear actions. Customers manage simulated policies/claims; staff review them. The
public landing route carries brand expression; account/admin routes favor familiar
task-oriented UI. Content is English; no additional locale or market is inferred.

Navy headings and restrained teal actions are the signature. Avoid neon dashboards,
decorative admin analytics and alarming full-page destructive actions.

Runtime ownership remains `src/app/globals.css` and `src/components/ui/Forms.tsx`.
This file mirrors their values; it does not generate or override tokens. The color
names above map to the matching `--brand-*`, `--background`, `--foreground` variables.
Typography maps to the self-hosted Inter setup in `src/app/layout.tsx`; shapes and
spacing map to existing Tailwind utilities in shared controls and account pages.

## Colors

Light surfaces, slate body/helper text, navy headings and teal primary actions.
Rose destructive/error treatments and explicit status text carry meaning together;
color alone does not convey request status. No new dark theme is introduced.

## Typography

Inter is used for body and display roles. Account headings use the existing 3xl/4xl
scale; card headings use xl; fields/actions use sm. Human names retain punctuation
and non-English characters. Full values wrap instead of disappearing behind ellipsis.

## Layout

Account pages use the existing max-w-5xl container, responsive horizontal padding
and vertically stacked cards. Admin management uses the same page shell and horizontal
table overflow on narrow viewports. Document scrolling owns the page; dialogs are
bounded to 90dvh with internal overflow. No customer or staff workflow is redesigned.

## Elevation & Depth

White cards have subtle borders/elevation. Existing header translucency is preserved.
Dialogs use the existing dark translucent overlay and higher stacking level. Ambient
lighting belongs to marketing, not administrative data or forms.

## Shapes

Shared controls retain rounded-xl treatment; dialogs retain rounded-2xl treatment.
Account rows use subtle dividers. Password masks are fixed decorative indicators,
not credential data or length measurements.

## Components

Use `Forms` for Button, Field, TextInput, TextArea and Card; account menu and Back
controls remain canonical. Controls retain hover/focus/disabled treatments. Pending
mutations disable repeat submission and announce concise status. Read-only fields
have no edit controls; errors remain inline and associated with fields.

Existing profile/password/deletion dialog styling and accessibility helpers remain
the reference: accessible title/description, inert background, focus entry/trap,
Escape when dismissible and focus restoration. Admin confirmation dialogs use those
helpers, not another modal framework. Visible status text accompanies badges.

Icons use the application's existing SVG components; labelled edit controls hide
decorative SVGs. No icon or animation library is added. Existing reduced-motion
handling remains in force; no motion is introduced to admin management.

Copy is calm and direct. Completion of request metadata must never imply erasure
when no destructive processor exists. Dates follow existing English formatting.

## Do's and Don'ts

- Do reuse shared cards, fields, controls, focus helpers and account spacing.
- Do display full values, meaningful labels and textual statuses.
- Don't invent optional cookie toggles or introduce tracking.
- Don't expose passwords, Auth mappings, privileged metadata or real deletion promises.
