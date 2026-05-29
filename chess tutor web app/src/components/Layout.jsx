import { Link, Outlet } from 'react-router-dom'
import { Container, Nav, Navbar } from "react-bootstrap"
import '../App.css'

export default function Layout() {
  return (
    <div>
        <Navbar variant="dark" className="app-navbar">
          <Container>
            <Navbar.Brand as={Link} to="/">Chess Tutor</Navbar.Brand>
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">Home</Nav.Link>
              <Nav.Link as={Link} to="/sicilian">Sicilian Defense Lesson</Nav.Link>
              <Nav.Link as={Link} to="/london">London Lesson</Nav.Link>
              <Nav.Link as={Link} to="/practice">Practice Board</Nav.Link>
              <Nav.Link as={Link} to="/quiz">Test Your Openings!</Nav.Link>
            </Nav>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <Outlet />
      </Container>
    </div>
  )
}
