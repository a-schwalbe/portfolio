import { Badge } from 'react-bootstrap'

export default function Header({ title, subtitle, badge }) {
  return (
    <header className="text-center mb-4">
      {badge && <Badge bg="dark" className="mb-2">{badge}</Badge>}
      <h1 className="display-5 fw-bold">{title}</h1>
      <p className="lead text-muted mx-auto" style={{ maxWidth: '750px' }}>
        {subtitle}
      </p>
    </header>
  )
}