import { useState } from 'react'
import { Alert, Button, Card, Stack } from 'react-bootstrap'

export default function QuizCard({ question, answers, correctAnswer, explanation }) {
  const [selected, setSelected] = useState(null)

  const answered = selected !== null
  const correct = selected === correctAnswer

  return (
    <Card className="shadow-sm border-0 rounded-4 mb-4 chess-card">
      <Card.Body>
        <h2 className="h4">{question}</h2>

        <Stack gap={2} className="mt-3">
          {answers.map(answer => (
            <Button
              key={answer}
              variant={selected === answer ? 'dark' : 'outline-dark'}
              onClick={() => setSelected(answer)}
            >
              {answer}
            </Button>
          ))}
        </Stack>

        {answered && (
          <Alert variant={correct ? 'success' : 'danger'} className="mt-3 mb-0">
            {correct ? 'Correct!' : `Not quite. Correct answer: ${correctAnswer}.`}
            {' '}
            {explanation}
          </Alert>
        )}
      </Card.Body>
    </Card>
  )
}