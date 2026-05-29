import ChessBoard from '../components/ChessBoard'
import LessonCard from '../components/LessonCard'
import OpeningMoves from '../components/OpeningMoves'
import Header from '../components/Header'
import Tips from '../components/tips'

export default function SicilianLessonPage() {
  const sicilianFen = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'

  return (
    <div>
      <Header
        title="Sicilian Defense"
        badge="Black Opening"
        subtitle="The Sicilian Defense begins with 1. e4 c5 and creates an aggressive, unbalanced game."
      />

      <LessonCard title="Main idea">
        <p>
          Instead of matching White with pawn e5, Black plays pawn c5 to fight for
          the center. This allows for Black pieces could create good counterplay on the queenside.
        </p>
      </LessonCard>

      <LessonCard title="Typical goals">
        <ul>
          <li>Pressure the d4 square.</li>
          <li>Create queenside counterplay.</li>
          <li>Fight for the center position</li>
          <li>Avoid symmetrical positions.</li>
          <li>Develop quickly and castle safely.</li>
        </ul>
      </LessonCard>

      <OpeningMoves
        moves={[
          'White plays pawn to e4 to control the center, the most common move',
          'Black responds pawn to c5, starting the Sicilian Defense.',
          'White often continues with moving the knight to f3',
          'If White plays knight to f3, Black plays knight to c6',
          'The common follow up is White playing pawn d4. The resulting move is Black playing Pawn takes from C5 to d4',
          'When you take the pawn on d4, white should play knight takes pawn on d4',
          'The resulting move for Black should be pushing the pawn from g7 to g6, to prepare putting the bishop on g7',

        ]}
      />

      <Tips>
        In the Sicilian, Black creates an unbalanced position leading to potential blunders for White!
      </Tips>

      <ChessBoard
        title="Sicilian Practice Board"
        description="This board starts after 1. e4 c5. Try exploring White's next moves."
        initialFen={sicilianFen}
      />
    </div>
  )
}