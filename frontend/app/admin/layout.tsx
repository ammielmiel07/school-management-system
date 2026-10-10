import PortalLayout from '@/components/PortalLayout';

const navGroups = [
  {
    title: "Overview",
    links: [
      { href: "/admin/dashboard", label: "Dashboard" },
      { href: "/admin/calendar", label: "Calendar" },
    ],
  },
  {
    title: "User Management",
    links: [
      { href: "/admin/accounts", label: "Manage Accounts" },
    ],
  },
  {
    title: "Academics",
    links: [
      { href: "/admin/faculty-loads", label: "Faculty Loads" },
      { href: "/admin/advisers", label: "Homeroom Advisers" },
      { href: "/admin/subjects", label: "Manage Subjects" },
      { href: "/admin/sections", label: "Manage Sections" },
      { href: "/admin/enrollments", label: "Enroll Students (Sectioning)" },
    ],
  },
  {
    title: "Configuration",
    links: [
      { href: "/admin/grading-setup", label: "Grading Setup" },
      { href: "/admin/settings", label: "System Settings" },
      { href: "/admin/carousel", label: "Announcements" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayout roleId="1" title="Admin" groups={navGroups}>{children}</PortalLayout>;
}
