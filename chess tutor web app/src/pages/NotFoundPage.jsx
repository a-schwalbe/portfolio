import '../App.css'
import { Card } from 'react-bootstrap'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="w-100 h-100 d-flex justify-content-center align-items-center">
      <Card className="m-4 p-2 chess-card">
        <Card.Body className='text-center'>
          <h1>404 — Page Not Found</h1>
          <p>The page you requested does not exist.</p>
          <Link to="/">Go back home</Link>
        </Card.Body>
      </Card>
    </div>
  )
}
