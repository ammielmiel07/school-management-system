import PortalLayout from '@/components/PortalLayout';

const groups = [
  {
    "title": "Menu",
    "links": [
      {
        "href": "/parent/dashboard",
        "label": "Dashboard"
      },
      {
        "href": "/parent/child-grades",
        "label": "Child Grades"
      }
    ]
  }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortalLayout roleId="4" title="Parent Portal" groups={groups}>{children}</PortalLayout>;
}
