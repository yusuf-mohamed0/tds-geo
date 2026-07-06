# Button Component

Buttons are used primarily for actions like "Add", "Close", "Cancel", or "Save".

## Usage
```tsx
import {Button} from '@shopify/polaris';

// Default (secondary)
<Button>Add product</Button>

// Primary
<Button variant="primary">Save</Button>

// Plain (link-like)
<Button variant="plain">View shipping settings</Button>

// Tertiary
<Button variant="tertiary">Cancel</Button>

// With icon
<Button icon={PlusIcon}>Add product</Button>

// Loading state
<Button loading variant="primary">Saving...</Button>

// Disabled
<Button disabled>Save</Button>

// Destructive tone
<Button tone="critical">Delete</Button>

// Success tone
<Button tone="success">Approve</Button>

// Full width
<Button fullWidth>Submit</Button>

// Icon only
<Button icon={DeleteIcon} accessibilityLabel="Delete" />
```

## Variants
- `primary`: Main actions
- `secondary` (default): Regular actions
- `plain`: Link-like, less important actions
- `tertiary`: Least prominent
- `monochromePlain`: Monochrome plain

## Tones
- `success`: Positive actions
- `critical`: Destructive/dangerous actions

## Best Practices
- Clear, predictable labels
- Lead with actionable verbs
- Use established colors appropriately
- Prioritize most important actions
- Sentence case, no articles, no punctuation

Source: https://polaris-react.shopify.com/components/actions/button
