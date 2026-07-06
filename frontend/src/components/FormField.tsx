import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

interface FormFieldBase {
  label: string
  error?: string
  hint?: string
  required?: boolean
}

// ─── Text Input ─────────────────────────────────
interface InputFieldProps extends FormFieldBase, Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel'
}

export function InputField({ label, error, hint, required, id, ...inputProps }: InputFieldProps) {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="form-group">
      <label htmlFor={fieldId}>
        {label}{required && <span className="required-mark"> *</span>}
      </label>
      <input
        id={fieldId}
        className={`form-input${error ? ' input-error' : ''}`}
        {...inputProps}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

// ─── Select ──────────────────────────────────────
interface SelectFieldProps extends FormFieldBase, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: { value: string; label: string }[]
  placeholder?: string
}

export function SelectField({ label, error, hint, required, id, options, placeholder, ...selectProps }: SelectFieldProps) {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="form-group">
      <label htmlFor={fieldId}>
        {label}{required && <span className="required-mark"> *</span>}
      </label>
      <select
        id={fieldId}
        className={`form-select${error ? ' input-error' : ''}`}
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

// ─── Textarea ────────────────────────────────────
interface TextareaFieldProps extends FormFieldBase, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {}

export function TextareaField({ label, error, hint, required, id, ...textareaProps }: TextareaFieldProps) {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="form-group">
      <label htmlFor={fieldId}>
        {label}{required && <span className="required-mark"> *</span>}
      </label>
      <textarea
        id={fieldId}
        className={`form-textarea${error ? ' input-error' : ''}`}
        {...textareaProps}
      />
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

// ─── Checkbox ────────────────────────────────────
interface CheckboxFieldProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  id?: string
}

export function CheckboxField({ label, checked, onChange, id }: CheckboxFieldProps) {
  const fieldId = id || `cb-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="form-group">
      <label htmlFor={fieldId} className="checkbox-label">
        <input
          id={fieldId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
    </div>
  )
}

// ─── Toggle ──────────────────────────────────────
interface ToggleFieldProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  id?: string
}

export function ToggleField({ label, checked, onChange, id }: ToggleFieldProps) {
  const fieldId = id || `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="form-group">
      <label htmlFor={fieldId} className="toggle-field-label">
        <span className="toggle-field-text">{label}</span>
        <div className="toggle">
          <input
            id={fieldId}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span className="toggle-slider" />
        </div>
      </label>
    </div>
  )
}

// ─── Form Row (grid helper) ──────────────────────
interface FormRowProps {
  children: ReactNode
  cols?: 2 | 3 | 4
}

export function FormRow({ children, cols = 2 }: FormRowProps) {
  return (
    <div className={`form-row form-row-${cols}`}>
      {children}
    </div>
  )
}
