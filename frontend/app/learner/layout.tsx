import PortalLayout from '@/components/PortalLayout';

const groups = [
  {
    "title": "Menu",
    "links": [
      {
        "href": "/learner/dashboard",
        "label": "Dashboard"
      },
      {
        "href": "/learner/my-grades",
        "label": "My Grades"
      }
    ]
  }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortalLayout roleId="3" title="Learner Portal" groups={groups}>{children}</PortalLayout>;
}
