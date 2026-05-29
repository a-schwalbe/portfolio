import { ListGroup } from 'react-bootstrap'

export default function OpeningMoves({moves}){
    return (
        <ListGroup className="shadow-sm mb-4">
            {moves.map((move, index) => (
                <ListGroup.Item key={move}>
                    <strong>{index+1}.</strong> {move}
                </ListGroup.Item>
            ))}
        </ListGroup>
    )
}