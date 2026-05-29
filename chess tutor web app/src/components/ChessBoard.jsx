import { useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { Button, Card, Stack, Badge } from 'react-bootstrap'

export default function ChessBoard({
  title = 'Interactive Chessboard',
  description = 'Play moves on the board.',
  initialFen = undefined
}) {
  function createInitialFen() {
    const chess = new Chess()
    if (initialFen) {
      chess.load(initialFen)
    }
    return chess.fen()
  }

  const [history, setHistory] = useState(() => [
    { fen: createInitialFen(), move: null }
  ])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [highlightedSquares, setHighlightedSquares] = useState({})

  const currentFen = history[currentIndex].fen
  const game = new Chess(currentFen)

  function clearSelection() {
    setSelectedSquare(null)
    setHighlightedSquares({})
  }

  function getHighlightStyles(square) {
    const tempGame = new Chess(currentFen)
    const moves = tempGame.moves({
      square,
      verbose: true
    })

    if (moves.length === 0) return {}

    const styles = {
      [square]: {
        boxShadow: 'inset 0 0 0 5px rgba(255, 215, 0, 0.95)',
      }
    }

    for (const move of moves) {
      styles[move.to] = {
        boxShadow: 'inset 0 0 0 5px rgba(0, 140, 255, 0.85)',
      }
    }

    return styles
  }

  function selectSquare(square) {
    const tempGame = new Chess(currentFen)
    const piece = tempGame.get(square)

    if (piece && piece.color === tempGame.turn()) {
      setSelectedSquare(square)
      setHighlightedSquares(getHighlightStyles(square))
    } else {
      clearSelection()
    }
  }

  function applyMove(from, to) {
    const tempGame = new Chess(currentFen)

    const legalMoves = tempGame.moves({
      square: from,
      verbose: true
    })

    const chosenMove = legalMoves.find(move => move.to === to)

    if (!chosenMove) {
      return false
    }

    const moveResult = tempGame.move({
      from,
      to,
      promotion: 'q'
    })

    const nextEntry = {
      fen: tempGame.fen(),
      move: moveResult.san
    }

    const branchedHistory = history.slice(0, currentIndex + 1)
    branchedHistory.push(nextEntry)

    setHistory(branchedHistory)
    setCurrentIndex(branchedHistory.length - 1)
    clearSelection()
    return true
  }

  function pieceMove({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false
    return applyMove(sourceSquare, targetSquare)
  }

  function handlePieceClick({ square }) {
    if (!square) return
    selectSquare(square)
  }

  function handleSquareClick({ square }) {
    if (!square) return

    if (selectedSquare) {
      if (selectedSquare === square) {
        clearSelection()
        return
      }

      const moved = applyMove(selectedSquare, square)
      if (moved) return
    }

    selectSquare(square)
  }

  function resetBoard() {
    setHistory([{ fen: createInitialFen(), move: null }])
    setCurrentIndex(0)
    clearSelection()
  }

  function undoMove() {
    if (currentIndex === 0) return
    setCurrentIndex(currentIndex - 1)
    clearSelection()
  }

  function redoMove() {
    if (currentIndex >= history.length - 1) return
    setCurrentIndex(currentIndex + 1)
    clearSelection()
  }

  const moveList = history
    .slice(1, currentIndex + 1)
    .map(entry => entry.move)

  const statusText = game.isCheckmate()
    ? 'Checkmate'
    : game.isDraw()
    ? 'Draw'
    : game.isCheck()
    ? `${game.turn() === 'w' ? 'White' : 'Black'} is in check`
    : `${game.turn() === 'w' ? 'White' : 'Black'} to move`

  return (
    <Card className="shadow-sm border-0 rounded-4 p-3 chess-card">
      <Card.Body>
        <div className="text-center mb-3">
          <h3 className="mb-2">{title}</h3>
          <p className="text-muted mb-2">{description}</p>
          <Badge bg="dark">{statusText}</Badge>
        </div>

        <div style={{ width: 'min(420px, 100%)', margin: '0 auto' }}>
          <Chessboard
            options={{
              position: currentFen,
              onPieceDrop: ({ sourceSquare, targetSquare }) =>
                pieceMove({ sourceSquare, targetSquare }),
              onPieceClick: ({ square }) =>
                handlePieceClick({ square }),
              onSquareClick: ({ square }) =>
                handleSquareClick({ square }),
              squareStyles: highlightedSquares,
              allowDragging: true,
              animationDurationInMs: 200
            }}
          />
        </div>

        <Stack
          direction="horizontal"
          gap={2}
          className="justify-content-center mt-3 flex-wrap"
        >
          <Button variant="secondary" onClick={resetBoard}>
            Reset
          </Button>
          <Button
            variant="outline-dark"
            onClick={undoMove}
            disabled={currentIndex === 0}
          >
            ← Undo
          </Button>
          <Button
            variant="outline-dark"
            onClick={redoMove}
            disabled={currentIndex >= history.length - 1}
          >
            Redo →
          </Button>
        </Stack>

        <div className="mt-3">
          <strong>Moves:</strong>{' '}
          {moveList.length > 0 ? moveList.join(', ') : 'No moves yet'}
        </div>
      </Card.Body>
    </Card>
  )
}