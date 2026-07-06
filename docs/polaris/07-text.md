# Text Component

Typography component for establishing hierarchy and communicating important content.

## Usage
```tsx
import {Text} from '@shopify/polaris';

// Headings
<Text variant="heading3xl" as="h1"> heading</Text>
<Text variant="heading2xl" as="h2"> heading</Text>
<Text variant="headingXl" as="h3"> heading</Text>
<Text variant="headingLg" as="h4"> heading</Text>
<Text variant="headingMd" as="h5"> heading</Text>
<Text variant="headingSm" as="h6"> heading</Text>
<Text variant="headingXs" as="h6"> heading</Text>

// Body
<Text variant="bodyLg" as="p">Large body text</Text>
<Text variant="bodyMd" as="p">Default body text</Text>
<Text variant="bodySm" as="p">Small body text</Text>
<Text variant="bodyXs" as="p">Extra small body text</Text>

// With tone
<Text as="span" tone="subdued">Subdued text</Text>
<Text as="span" tone="success">Success text</Text>
<Text as="span" tone="critical">Critical text</Text>
<Text as="span" tone="warning">Warning text</Text>
<Text as="span" tone="magic">Magic AI text</Text>

// With weight
<Text as="p" fontWeight="bold">Bold text</Text>
<Text as="p" fontWeight="semibold">Semibold text</Text>
<Text as="p" fontWeight="medium">Medium text</Text>
<Text as="p" fontWeight="regular">Regular text</Text>

// With alignment
<Text as="p" alignment="center">Centered text</Text>
<Text as="p" alignment="end">Right aligned text</Text>

// Visually hidden (screen reader only)
<Text visuallyHidden as="h2">Hidden heading</Text>

// Truncate
<Text as="p" truncate>Long text that will be truncated...</Text>
```

## Variants
| Variant | Font Size | Use |
|---------|-----------|-----|
| heading3xl | 36px | Page titles |
| heading2xl | 30px | Section headers |
| headingXl | 24px | Major sections |
| headingLg | 20px | Card titles |
| headingMd | 14px | Card section titles |
| headingSm | 13px | Subheadings |
| headingXs | 12px | Small labels |
| bodyLg | 14px | Large body |
| bodyMd | 13px | Default body |
| bodySm | 12px | Captions/secondary |
| bodyXs | 11px | Smallest text |

Source: https://polaris-react.shopify.com/components/typography/text
