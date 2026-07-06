# Card Component

Cards group similar concepts and tasks together for merchants to scan, read, and get things done.

## Usage
```tsx
import {Card, Text} from '@shopify/polaris';

function MyCard() {
  return (
    <Card>
      <Text as="h2" variant="bodyMd">
        Content inside a card
      </Text>
    </Card>
  );
}

// With sections
<Card>
  <Card.Section title="Section title">
    <p>Section content</p>
  </Card.Section>
  <Card.Section title="Another section">
    <p>More content</p>
  </Card.Section>
</Card>

// With header actions
<Card>
  <div style={{display: 'flex', justifyContent: 'space-between', padding: 'var(--p-space-400)'}}>
    <Text as="h2" variant="headingMd">Card title</Text>
    <Button onClick={() => {}}>Edit</Button>
  </div>
  <Card.Section>
    <p>Content</p>
  </Card.Section>
</Card>
```

## Key Props
- `background`: Background color alias (defaults to 'bg-surface')
- `padding`: Spacing around card (defaults to {xs: '400', sm: '500'})
- `roundedAbove`: Border radius above a breakpoint (defaults to 'sm')

## Best Practices
- Group related information
- Prioritize what merchants need to know most first
- Use clear headings
- One primary CTA per card
- Put actions on the bottom for next steps, upper right for persistent options

Source: https://polaris-react.shopify.com/components/layout-and-structure/card
