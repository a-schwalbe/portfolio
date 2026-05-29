import '../App.css'
import { Button, Card, Col, Row, Stack } from 'react-bootstrap'

import {useNavigate} from 'react-router-dom'
import LessonCard from '../components/LessonCard'
import Header from '../components/Header'

export default function HomePage() {
  const navigate = useNavigate();

  function goToRandomLesson(){
    const lessons = ['/sicilian', '/london'];
    navigate(lessons[Math.floor(Math.random()*lessons.length)]);
  }
  
  
  return (
    <div>
      <Card className="shadow-lg border-0 rounded-4 p-4 mb-5 chess-card">
        <Card.Body className="text-center">
          <Header
            badge="Interactive Chess Learning"
            title="Chess Tutor"
            subtitle="Learn beginner-friendly chess openings through lessons, practice boards, and quick quizzes."
          />

          <Stack direction="horizontal" gap={3} className="justify-content-center flex-wrap">
            <Button className="btn-chess" onClick={() => navigate('/sicilian')}>
              Start Sicilian
            </Button>
            <Button variant="secondary" onClick={() => navigate('/london')}>
              Start London
            </Button>
            <Button variant="outline-dark" onClick={goToRandomLesson}>
              Random Lesson
            </Button>
          </Stack>
        </Card.Body>
      </Card>

      <Row className="g-4">
        <Col md={4}>
          <LessonCard title="Opening Lessons" text="Learn the Sicilian Defense and London System"/>
        </Col>
        <Col md={4}>
          <LessonCard title="Interactive Chessboard" text="Practice games to test different chess lines"/>
        </Col>
        <Col md={4}>
          <LessonCard title="Quizzes" text="Test your knowledge of openings with simple questions!"/>
        </Col>
      </Row>
    </div>
  )
}
