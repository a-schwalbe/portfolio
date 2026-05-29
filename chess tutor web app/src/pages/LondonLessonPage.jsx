import ChessBoard from '../components/ChessBoard'
import LessonCard from '../components/LessonCard'
import Header from '../components/Header'
import Tips from '../components/tips'
import OpeningMoves from '../components/OpeningMoves'

export default function LondonLessonPage() {
  const londonFen = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1'

  return (
    <div>
      <Header
        title="London System"
        badge="White Opening"
        subtitle="The London System is a reliable opening setup for White based on d4, Bf4, Nf3, e3, and c3."
      />

      <LessonCard title="Main idea">
        <p>
          The London System is a popular opening for the White pieces. It creates a balanced center with limited counterplay for Black.
        </p>
      </LessonCard>

      <LessonCard title="Typical goals">
        <ul>
          <li>Play d4 and develop the dark-square bishop to f4.</li>
          <li>Support the center with e3 and c3.</li>
          <li>Develop pieces early to take up open space</li>
          <li>Castle early so the king is safe.</li>
        </ul>
      </LessonCard>

      <OpeningMoves
        moves={[
          'White starts with pawn to d4.',
          'The most common move played by Black is d5',
          'White should immediately move bishop to f4',
          'Afterwords, if the bishop isnt pressured the move pawn to e4 should be played',
          'if the bishop remains unpressured, move knight to f3',
          'Black pieces will most likely develop both of their knights and bishop',
          'The goal will be moving the bishop to d3, and castling, creating a solid foundation covering the center'
        ]}
      />

      <Tips>
        The London is especially useful for beginners because the setup is easy to remember.
      </Tips>

      <ChessBoard
        title="London Practice Board"
        description="This board starts after 1. d4. Try building the London setup."
        initialFen={londonFen}
      />
    </div>
  )
}