# Resource Details Layout Pattern

Lets merchants create, view, and edit resource objects.

## Structure
1. Page header spans full width - actions + navigation
2. Main content: 2-column layout
   - Primary content (left, 2/3 width): most important info
   - Secondary content (right, 1/3 width): supporting info
3. Content grouped in Cards

## Components Used
- `Page` (with backAction, title, secondaryActions, pagination)
- `Card`
- `BlockStack`
- `InlineGrid` (columns={{xs: 1, md: "2fr 1fr"}})
- `Box`
- `Divider`

## Code Pattern
```tsx
<Page
  backAction={{content: "Products", url: "/products"}}
  title="Product detail"
  secondaryActions={[
    {content: "Duplicate", icon: DuplicateIcon},
    {content: "Archive", icon: ArchiveIcon, destructive: true},
  ]}
  pagination={{hasPrevious: true, hasNext: true}}
>
  <InlineGrid columns={{xs: 1, md: "2fr 1fr"}} gap="400">
    <BlockStack gap="400">
      {/* Primary content */}
      <Card roundedAbove="sm">
        <p>Main content area</p>
      </Card>
    </BlockStack>
    <BlockStack gap={{xs: "400", md: "200"}}>
      {/* Secondary content */}
      <Card roundedAbove="sm">
        <p>Sidebar info</p>
      </Card>
    </BlockStack>
  </InlineGrid>
</Page>
```

## Tips
- Use default width (not full width)
- Group similar content in same card
- Primary column = defining info, Secondary = status/metadata/summaries
- Arrange in order of importance
- Unique page actions at top of list, typical actions at bottom

Source: https://polaris-react.shopify.com/patterns/resource-details-layout
