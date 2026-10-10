import PortalLayout from '@/components/PortalLayout';

const groups = [
  {
    "title": "Menu",
    "links": [
      {
        "href": "/faculty/dashboard",
        "label": "Dashboard"
      },
      {
        "href": "/faculty/my-classes",
        "label": "My Classes"
      },
      {
        "href": "/faculty/advisory",
        "label": "Advisory Class"
      },
      {
        "href": "/faculty/attendance",
        "label": "Monthly Attendance"
      }
    ]
  }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortalLayout roleId="2" title="Faculty Portal" groups={groups}>{children}</PortalLayout>;
}
