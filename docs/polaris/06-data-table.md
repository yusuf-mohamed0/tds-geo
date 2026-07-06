# Data Table Component

Data tables organize and display all information from a data set, letting merchants compare and analyze data.

## Usage
```tsx
import {Page, Card, DataTable} from '@shopify/polaris';

function MyTable() {
  const rows = [
    ['Product A', '$875.00', 124689, 140, '$122,500.00'],
    ['Product B', '$230.00', 124533, 83, '$19,090.00'],
    ['Product C', '$445.00', 124518, 32, '$14,240.00'],
  ];

  return (
    <Page title="Sales by product">
      <Card padding="0">
        <DataTable
          columnContentTypes={['text', 'numeric', 'numeric', 'numeric', 'numeric']}
          headings={['Product', 'Price', 'SKU', 'Net quantity', 'Net sales']}
          rows={rows}
          totals={['', '', '', 255, '$155,830.00']}
          sortable={[false, true, true, true, true]}
          defaultSortDirection="descending"
          initialSortColumnIndex={4}
          onSort={(headingIndex, direction) => {}}
          footerContent="Showing 3 of 3 results"
          stickyHeader
          hasZebraStripingOnData
          increasedTableDensity
        />
      </Card>
    </Page>
  );
}
```

## Key Props
- `columnContentTypes`: Array of 'text' | 'numeric' (controls alignment)
- `headings`: Array of column heading content
- `rows`: 2D array of row data
- `totals`: Summary row values
- `sortable`: Boolean array for sortable columns
- `onSort`: Sort callback (headingIndex, direction)
- `stickyHeader`: Pin header on scroll
- `hasZebraStripingOnData`: Alternating row colors
- `increasedTableDensity`: Compact layout
- `fixedFirstColumns`: Number of fixed columns on horizontal scroll
- `pagination`: Pagination controls
- `footerContent`: Centered footer content

## Best Practices
- Show values across multiple categories
- Minimize clutter
- Include summary row for totals
- Wrap instead of truncate content
- Numerical = right aligned, Text = left aligned
- Don't use for actionable list items (use ResourceList instead)

Source: https://polaris-react.shopify.com/components/tables/data-table
