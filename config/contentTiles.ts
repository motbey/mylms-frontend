import React from 'react';
import { SLUGS } from './slugs';

// --- Icon Type ---
interface IconProps {
  className?: string;
}

// --- Icons for Content Tiles ---
const ElearningIcon: React.FC<IconProps> = ({ className }) => React.createElement(
    'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" })
);
const CompetenciesIcon: React.FC<IconProps> = ({ className }) => React.createElement(
    'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" })
);
const CoursesIcon: React.FC<IconProps> = ({ className }) => React.createElement(
    'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
    React.createElement('path', { d: "M12 14l9-5-9-5-9 5 9 5z" }),
    React.createElement('path', { d: "M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-9.998 12.078 12.078 0 01.665-6.479L12 14z" }),
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 14l9-5-9-5-9 5 9 5zm0 0v6" })
);
const FormsIcon: React.FC<IconProps> = ({ className }) => React.createElement(
    'svg', { xmlns: "http://www.w3.org/2000/svg", className: className || "h-10 w-10 text-secondary", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5 },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" })
);
export const DocumentPlusIcon: React.FC<IconProps> = ({ className }) => React.createElement(
    'svg', { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, className: className || "h-10 w-10 text-secondary" },
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M14 2H8a2 2 0 00-2 2v16a2 2 0 002 2h8a2 2 0 002-2V8l-4-6z" }),
    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M14 2v6h6M12 10v8m4-4H8" })
);

// --- Tile Configuration ---
export type ContentTile = {
  slug: string;
  label: string;
  description: string;
  to: string;
  icon: React.ReactElement;
};

export const contentTiles: ContentTile[] = [
  {
    slug: SLUGS.CONTENT_MODULES,
    label: "E-Learning Modules",
    description: "Upload and manage e-learning materials.",
    to: "/admin/content/elearning",
    icon: React.createElement(ElearningIcon),
  },
  {
    slug: SLUGS.CONTENT_COMPETENCIES,
    label: "Competencies",
    description: "Define and track skill competencies.",
    to: "/admin/content/competencies",
    icon: React.createElement(CompetenciesIcon),
  },
  {
    slug: SLUGS.CONTENT_COURSES,
    label: "Courses",
    description: "Build and manage courses and curricula.",
    to: "/admin/content/courses",
    icon: React.createElement(CoursesIcon),
  },
  {
    slug: SLUGS.CONTENT_FORMS,
    label: "Forms",
    description: "Create and manage custom forms and surveys.",
    to: "/admin/content/forms",
    icon: React.createElement(FormsIcon),
  },
];

// Action-specific tiles that can be favourited but don't appear on the main dashboard.
export const contentActionTiles: ContentTile[] = [
  {
    slug: SLUGS.CONTENT_FORMS_CREATE,
    label: "Create Form",
    description: "Start a new custom form.",
    to: "/admin/content/forms/create",
    icon: React.createElement(DocumentPlusIcon),
  }
];
