import Header from '../components/Header'
import QuizCard from '../components/QuizCard'

export default function QuizPage() {
  return (
    <div>
      <Header
        title="Opening Quiz"
        badge="Knowledge Check"
        subtitle="Test what you know about the Sicilian Defense and London System."
      />

      <QuizCard
        question="What is the first move in the London System?"
        answers={['d4', 'e4', 'h4', 'c3']}
        correctAnswer="d4"
        explanation="The London System usually starts with pawn d4."
      />

      <QuizCard
        question="What is Black’s first move in the Sicilian Defense?"
        answers={['c5', 'e5', 'd5', 'Nf6']}
        correctAnswer="c5"
        explanation="The Sicilian Defense begins with pawn e4, pawn to c5."
      />

      <QuizCard
        question="What is one major goal of opening play?"
        answers={['Develop pieces', 'Move the queen repeatedly', 'Ignore the center', 'Avoid castling']}
        correctAnswer="Develop pieces"
        explanation="Good openings usually focus on development, king safety, and central control."
      />

        <QuizCard
        question="With the Sicilian Defense, is the resulting position balanced or unbalanced?"
        answers={['Balanced', 'Unbalanced']}
        correctAnswer="Balanced"
        explanation="The Sicilian defense creates an unbalanced position, that attacks the center."
      />

        <QuizCard
        question="What makes the london opening a good opening for players to use?"
        answers={['it prevents Black from having early counterplay', 'It gives up the center', 'It allows for early attacks on your king', 'it is an uncommon opening catching others off guard']}
        correctAnswer="it prevents Black from having early counterplay"
        explanation="The London opening allows for early castling of the king, making it safe early on."
      />
    </div>
  )
}