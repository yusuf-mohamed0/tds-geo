import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', style }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
  action?: ReactNode
}

export function CardHeader({ children, className = '', action }: CardHeaderProps) {
  return (
    <div className={`card-header ${className}`}>
      <h3>{children}</h3>
      {action && <div className="card-actions">{action}</div>}
    </div>
  )
}

interface CardBodyProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  padding?: boolean
}

export function CardBody({ children, className = '', style, padding = true }: CardBodyProps) {
  return (
    <div
      className={`card-body ${padding ? '' : 'card-body-no-padding '}${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

interface CardFooterProps {
  children: ReactNode
  className?: string
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return <div className={`card-footer ${className}`}>{children}</div>
}
