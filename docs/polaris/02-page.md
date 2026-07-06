# Page Component

Use to build the outer wrapper of a page, including the page title and associated actions.

## Usage
```tsx
import {Page, Badge, Card, Text} from '@shopify/polaris';

function MyPage() {
  return (
    <Page
      backAction={{content: 'Products', url: '#'}}
      title="Product"
      titleMetadata={<Badge tone="success">Active</Badge>}
      subtitle="Product subtitle"
      compactTitle
      primaryAction={{content: 'Save'}}
      secondaryActions={[
        {content: 'Duplicate', onAction: () => {}},
        {content: 'View', onAction: () => {}},
      ]}
      actionGroups={[
        {
          title: 'Promote',
          actions: [{content: 'Share on Facebook'}],
        },
      ]}
      pagination={{hasPrevious: true, hasNext: true}}
    >
      <Card>
        <Text as="h2" variant="bodyMd">
          Content
        </Text>
      </Card>
    </Page>
  );
}
```

## Key Props
- `title`: Page title
- `subtitle`: Page subtitle
- `titleMetadata`: Important status info (Badge)
- `primaryAction`: Primary CTA
- `secondaryActions`: Secondary CTAs
- `actionGroups`: Grouped secondary actions
- `backAction`: Back link/breadcrumb
- `pagination`: Previous/next navigation
- `fullWidth`: Remove max-width
- `narrowWidth`: Decrease max-width for single-column layouts

## Best Practices
- Always provide a title
- Always provide breadcrumbs when page has a parent
- Organize around a primary activity
- Use pagination for object detail pages

Source: https://polaris-react.shopify.com/components/layout-and-structure/page
