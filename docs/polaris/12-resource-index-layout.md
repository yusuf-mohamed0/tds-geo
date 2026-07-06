# Resource Index Layout Pattern

Lets merchants organize and take action on resource objects (products, orders, customers).

## Structure
1. Single column layout - clear top-to-bottom hierarchy
2. Page title + actions at top (affect the index as a whole)
3. Filters, sorting, multi-select actions below title
4. Main body: individual resource objects

## Components Used
- `Page` (with title + primaryAction + secondaryActions)
- `Card` (padding="0")
- `IndexTable` or `DataTable`
- `IndexFilters` or `Filters`
- `Badge`
- `ChoiceList`

## Code Pattern
```tsx
<Page
  title="Products"
  primaryAction={{content: "Add product"}}
  secondaryActions={[
    {content: "Export"},
    {content: "Import"},
  ]}
>
  <Card padding="0">
    <IndexFilters
      sortOptions={sortOptions}
      sortSelected={sortSelected}
      queryValue={queryValue}
      onQueryChange={setQueryValue}
      filters={filters}
      appliedFilters={appliedFilters}
      onClearAll={handleClearAll}
    />
    <IndexTable
      resourceName={{singular: 'product', plural: 'products'}}
      itemCount={items.length}
      headings={[{title: 'Product'}, {title: 'Price'}]}
    >
      {rows}
    </IndexTable>
  </Card>
</Page>
```

## Tips
- Use resource type as page title
- Primary action (top right) = resource creation
- Normal page width (not full width)
- Pair with Resource Details Layout for detail pages

Source: https://polaris-react.shopify.com/patterns/resource-index-layout
